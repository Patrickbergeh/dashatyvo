import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GRAPH = "https://graph.facebook.com/v20.0";

// Puxa as campanhas da conta (Graph API), salva/atualiza em ad_campaigns
// preservando o is_tracked que o usuário escolheu, e devolve a lista.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: integ, error } = await supabase
    .from("facebook_integrations")
    .select("ad_account_id, access_token")
    .eq("id", params.id)
    .single();

  if (error || !integ?.access_token) {
    return NextResponse.json({ error: "conta não encontrada" }, { status: 404 });
  }

  const url =
    `${GRAPH}/${integ.ad_account_id}/campaigns` +
    `?fields=name,status,objective&limit=200` +
    `&access_token=${encodeURIComponent(integ.access_token)}`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });

  const fetched = (data.data ?? []) as any[];

  if (fetched.length) {
    // upsert sem sobrescrever is_tracked (default true só na 1ª vez)
    await supabase.from("ad_campaigns").upsert(
      fetched.map((c) => ({
        user_id: user.id,
        ad_account_id: integ.ad_account_id,
        campaign_id: c.id,
        campaign_name: c.name,
        status: c.status,
        objective: c.objective,
      })),
      { onConflict: "user_id,campaign_id", ignoreDuplicates: false }
    );
  }

  const { data: rows } = await supabase
    .from("ad_campaigns")
    .select("id, campaign_id, campaign_name, status, objective, is_tracked")
    .eq("ad_account_id", integ.ad_account_id)
    .order("campaign_name", { ascending: true });

  return NextResponse.json({ campaigns: rows ?? [] });
}
