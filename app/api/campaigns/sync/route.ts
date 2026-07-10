import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GRAPH = "https://graph.facebook.com/v20.0";

// Soma valores de uma lista de tipos de ação (ex.: compras em pixel/onsite)
const PURCHASE_TYPES = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
  "omni_purchase",
];
const CHECKOUT_TYPES = [
  "initiate_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
  "onsite_web_initiate_checkout",
  "omni_initiated_checkout",
];
function sumActions(arr: any[], types: string[]): number {
  if (!Array.isArray(arr)) return 0;
  return arr
    .filter((a) => types.includes(a.action_type))
    .reduce((s, a) => s + Number(a.value ?? 0), 0);
}
function actionValue(arr: any[], type: string): number {
  if (!Array.isArray(arr)) return 0;
  const hit = arr.find((a) => a.action_type === type);
  return hit ? Number(hit.value ?? 0) : 0;
}

// Sincroniza insights das campanhas ATIVADAS -> ad_metrics
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const days = Number(body.days ?? 30);

  const { data: integs } = await supabase
    .from("facebook_integrations")
    .select("ad_account_id, access_token")
    .eq("is_active", true);
  if (!integs?.length) {
    return NextResponse.json({ error: "nenhuma conta ativa" }, { status: 400 });
  }

  const { data: allCamps } = await supabase
    .from("ad_campaigns")
    .select("campaign_id, is_tracked");
  const trackedSet = new Set(
    (allCamps ?? []).filter((c) => c.is_tracked).map((c) => c.campaign_id)
  );
  if (trackedSet.size === 0) {
    return NextResponse.json({ synced: 0, note: "nenhuma campanha ativada" });
  }

  // time_range incluindo HOJE (date_preset=last_Xd não traz o dia atual)
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const timeRange = encodeURIComponent(
    JSON.stringify({ since: fmt(since), until: fmt(until) })
  );

  const allRows: any[] = [];
  for (const integ of integs) {
    const fields =
      "campaign_id,campaign_name,spend,impressions,reach,clicks,actions,action_values";
    const url =
      `${GRAPH}/${integ.ad_account_id}/insights` +
      `?level=campaign&time_increment=1&time_range=${timeRange}` +
      `&fields=${fields}&limit=500&access_token=${encodeURIComponent(integ.access_token)}`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.error) continue;

    for (const r of data.data ?? []) {
      if (!trackedSet.has(r.campaign_id)) continue;
      allRows.push({
        user_id: user.id,
        ad_account_id: integ.ad_account_id,
        campaign_id: r.campaign_id ?? null,
        campaign_name: r.campaign_name ?? null,
        date: r.date_start,
        spend: Number(r.spend ?? 0),
        impressions: Number(r.impressions ?? 0),
        reach: Number(r.reach ?? 0),
        clicks: Number(r.clicks ?? 0),
        link_clicks: actionValue(r.actions, "link_click"),
        landing_page_views: actionValue(r.actions, "landing_page_view"),
        initiate_checkout: sumActions(r.actions, CHECKOUT_TYPES),
        sales: sumActions(r.actions, PURCHASE_TYPES),
        revenue: sumActions(r.action_values, PURCHASE_TYPES),
        source: "meta_api",
      });
    }
  }

  if (allRows.length) {
    const { error: upErr } = await supabase
      .from("ad_metrics")
      .upsert(allRows, { onConflict: "user_id,ad_account_id,campaign_id,date" });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  return NextResponse.json({ synced: allRows.length });
}
