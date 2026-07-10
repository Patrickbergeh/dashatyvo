import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GRAPH = "https://graph.facebook.com/v20.0";

function findAction(arr: any[], type: string): number {
  if (!Array.isArray(arr)) return 0;
  const hit = arr.find((a) => a.action_type === type);
  return hit ? Number(hit.value ?? 0) : 0;
}

// Sincroniza os insights da conta -> grava em ad_metrics
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const days = Number(body.days ?? 30);

  const { data: integ, error } = await supabase
    .from("facebook_integrations")
    .select("ad_account_id, access_token, is_active")
    .eq("id", params.id)
    .single();

  if (error || !integ?.access_token) {
    return NextResponse.json({ error: "conta não encontrada" }, { status: 404 });
  }
  if (!integ.is_active) {
    return NextResponse.json({ error: "conta desativada" }, { status: 400 });
  }

  const fields =
    "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values";
  const url =
    `${GRAPH}/${integ.ad_account_id}/insights` +
    `?level=campaign&time_increment=1&date_preset=last_${days}d` +
    `&fields=${fields}&limit=500&access_token=${encodeURIComponent(integ.access_token)}`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });

  const rows = (data.data ?? []).map((r: any) => ({
    user_id: user.id,
    ad_account_id: integ.ad_account_id,
    campaign_id: r.campaign_id ?? null,
    campaign_name: r.campaign_name ?? null,
    date: r.date_start,
    spend: Number(r.spend ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    sales: findAction(r.actions, "purchase"),
    revenue: findAction(r.action_values, "purchase"),
    source: "meta_api",
  }));

  if (rows.length) {
    const { error: upErr } = await supabase
      .from("ad_metrics")
      .upsert(rows, { onConflict: "user_id,ad_account_id,campaign_id,date" });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  return NextResponse.json({ synced: rows.length });
}
