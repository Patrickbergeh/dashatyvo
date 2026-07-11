import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GRAPH = "https://graph.facebook.com/v20.0";

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
function av(arr: any[], type: string): number {
  if (!Array.isArray(arr)) return 0;
  const hit = arr.find((a) => a.action_type === type);
  return hit ? Number(hit.value ?? 0) : 0;
}
function sum(arr: any[], types: string[]): number {
  if (!Array.isArray(arr)) return 0;
  return arr
    .filter((a) => types.includes(a.action_type))
    .reduce((s, a) => s + Number(a.value ?? 0), 0);
}
// Busca TODAS as páginas (segue paging.next) -> nunca trunca.
async function fetchAll(url: string): Promise<any[]> {
  const out: any[] = [];
  let next: string | null = url;
  let guard = 0;
  while (next && guard < 50) {
    guard++;
    const res = await fetch(next);
    const json: any = await res.json();
    if (json.error) break;
    out.push(...(json.data ?? []));
    next = json.paging?.next ?? null;
  }
  return out;
}
function metricsRow(r: any) {
  return {
    spend: Number(r.spend ?? 0),
    impressions: Number(r.impressions ?? 0),
    reach: Number(r.reach ?? 0),
    clicks: Number(r.clicks ?? 0),
    link_clicks: av(r.actions, "link_click"),
    landing_page_views: av(r.actions, "landing_page_view"),
    initiate_checkout: sum(r.actions, CHECKOUT_TYPES),
    sales: sum(r.actions, PURCHASE_TYPES),
    revenue: sum(r.action_values, PURCHASE_TYPES),
  };
}

// POST /api/funnel/sync  { days }
// Puxa conjuntos e anúncios (diário) da Meta e salva no banco.
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

  const { data: camps } = await supabase
    .from("ad_campaigns")
    .select("campaign_id")
    .eq("is_tracked", true);
  const trackedCamps = new Set((camps ?? []).map((c) => c.campaign_id));

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const tr = `time_range=${encodeURIComponent(
    JSON.stringify({ since: fmt(since), until: fmt(until) })
  )}`;

  let adsetRows = 0;
  let adRows = 0;

  for (const integ of integs) {
    const acct = integ.ad_account_id;
    const token = encodeURIComponent(integ.access_token);

    // ---- CONJUNTOS ---- (todas as páginas, sem truncar)
    try {
      const meta = (
        await fetchAll(
          `${GRAPH}/${acct}/adsets?fields=id,name,status,campaign_id,created_time&limit=500&access_token=${token}`
        )
      ).filter((a: any) => trackedCamps.has(a.campaign_id));
      for (let i = 0; i < meta.length; i += 500) {
        await supabase.from("ad_adsets").upsert(
          meta.slice(i, i + 500).map((a: any) => ({
            user_id: user.id,
            ad_account_id: acct,
            campaign_id: a.campaign_id,
            adset_id: a.id,
            name: a.name,
            status: a.status,
            fb_created_time: a.created_time,
          })),
          { onConflict: "user_id,adset_id" }
        );
      }

      const rows = (
        await fetchAll(
          `${GRAPH}/${acct}/insights?level=adset&time_increment=1&${tr}&fields=adset_id,campaign_id,spend,impressions,reach,clicks,actions,action_values&limit=500&access_token=${token}`
        )
      )
        .filter((r: any) => trackedCamps.has(r.campaign_id))
        .map((r: any) => ({
          user_id: user.id,
          ad_account_id: acct,
          campaign_id: r.campaign_id,
          adset_id: r.adset_id,
          date: r.date_start,
          ...metricsRow(r),
        }));
      for (let i = 0; i < rows.length; i += 500) {
        await supabase
          .from("adset_metrics")
          .upsert(rows.slice(i, i + 500), { onConflict: "user_id,adset_id,date" });
      }
      adsetRows += rows.length;
    } catch {
      /* segue */
    }

    // ---- ANÚNCIOS ---- (todas as páginas)
    try {
      const meta = (
        await fetchAll(
          `${GRAPH}/${acct}/ads?fields=id,name,status,adset_id,campaign_id,created_time,creative%7Bthumbnail_url,image_url%7D&limit=500&access_token=${token}`
        )
      ).filter((a: any) => trackedCamps.has(a.campaign_id));
      for (let i = 0; i < meta.length; i += 500) {
        await supabase.from("ad_ads").upsert(
          meta.slice(i, i + 500).map((a: any) => ({
            user_id: user.id,
            ad_account_id: acct,
            campaign_id: a.campaign_id,
            adset_id: a.adset_id,
            ad_id: a.id,
            name: a.name,
            status: a.status,
            thumbnail_url: a.creative?.thumbnail_url ?? null,
            image_url: a.creative?.image_url ?? null,
            fb_created_time: a.created_time,
          })),
          { onConflict: "user_id,ad_id" }
        );
      }

      const rows = (
        await fetchAll(
          `${GRAPH}/${acct}/insights?level=ad&time_increment=1&${tr}&fields=ad_id,adset_id,campaign_id,spend,impressions,reach,clicks,actions,action_values&limit=500&access_token=${token}`
        )
      )
        .filter((r: any) => trackedCamps.has(r.campaign_id))
        .map((r: any) => ({
          user_id: user.id,
          ad_account_id: acct,
          campaign_id: r.campaign_id,
          adset_id: r.adset_id,
          ad_id: r.ad_id,
          date: r.date_start,
          ...metricsRow(r),
        }));
      for (let i = 0; i < rows.length; i += 500) {
        await supabase
          .from("ad_daily_metrics")
          .upsert(rows.slice(i, i + 500), { onConflict: "user_id,ad_id,date" });
      }
      adRows += rows.length;

      // Eficiência (diagnósticos de relevância) — insights agregado do período
      const eff = (
        await fetchAll(
          `${GRAPH}/${acct}/insights?level=ad&${tr}&fields=ad_id,campaign_id,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&limit=500&access_token=${token}`
        )
      ).filter((r: any) => trackedCamps.has(r.campaign_id));
      for (let i = 0; i < eff.length; i += 500) {
        await supabase.from("ad_ads").upsert(
          eff.slice(i, i + 500).map((r: any) => ({
            user_id: user.id,
            ad_id: r.ad_id,
            quality_ranking: r.quality_ranking ?? null,
            engagement_rate_ranking: r.engagement_rate_ranking ?? null,
            conversion_rate_ranking: r.conversion_rate_ranking ?? null,
          })),
          { onConflict: "user_id,ad_id" }
        );
      }
    } catch {
      /* segue */
    }
  }

  return NextResponse.json({ adsetRows, adRows });
}
