import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GRAPH = "https://graph.facebook.com/v20.0";

// Re-puxa a lista de campanhas do Graph API para as contas ativas
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: integs } = await supabase
    .from("facebook_integrations")
    .select("ad_account_id, access_token")
    .eq("is_active", true);

  if (!integs?.length) {
    return NextResponse.json({ error: "nenhuma conta ativa" }, { status: 400 });
  }

  let total = 0;
  for (const integ of integs) {
    const url =
      `${GRAPH}/${integ.ad_account_id}/campaigns` +
      `?fields=name,status,objective&limit=500` +
      `&access_token=${encodeURIComponent(integ.access_token)}`;
    const res = await fetch(url);
    const data = await res.json();
    const camps = (data.data ?? []) as any[];
    if (camps.length) {
      await supabase.from("ad_campaigns").upsert(
        camps.map((c) => ({
          user_id: user.id,
          ad_account_id: integ.ad_account_id,
          campaign_id: c.id,
          campaign_name: c.name,
          status: c.status,
          objective: c.objective,
        })),
        { onConflict: "user_id,campaign_id" }
      );
      total += camps.length;
    }
  }

  return NextResponse.json({ refreshed: total });
}
