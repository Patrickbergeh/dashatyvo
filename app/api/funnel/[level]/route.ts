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
  return arr.filter((a) => types.includes(a.action_type)).reduce((s, a) => s + Number(a.value ?? 0), 0);
}

function timeRangeParam(since: string | null, until: string | null) {
  if (since && until) {
    return `time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`;
  }
  return "date_preset=maximum";
}

// GET /api/funnel/adsets|ads?since=&until=
export async function GET(
  req: Request,
  { params }: { params: { level: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const level = params.level; // "adsets" | "ads"
  const url = new URL(req.url);
  const tr = timeRangeParam(url.searchParams.get("since"), url.searchParams.get("until"));

  const { data: integ } = await supabase
    .from("facebook_integrations")
    .select("ad_account_id, access_token")
    .eq("is_active", true)
    .limit(1)
    .single();
  if (!integ?.access_token) {
    return NextResponse.json({ error: "nenhuma conta ativa" }, { status: 400 });
  }
  const token = integ.access_token;
  const acct = integ.ad_account_id;

  // campanhas ativadas
  const { data: camps } = await supabase
    .from("ad_campaigns")
    .select("campaign_id")
    .eq("is_tracked", true);
  const trackedCamps = new Set((camps ?? []).map((c) => c.campaign_id));

  if (level === "adsets") {
    // entidades
    const listRes = await fetch(
      `${GRAPH}/${acct}/adsets?fields=id,name,status,campaign_id,created_time&limit=500&access_token=${encodeURIComponent(token)}`
    );
    const list = await listRes.json();
    // Fallback: Meta indisponível (rate limit) -> devolve do banco (sem sumir)
    if (list.error) {
      const { data: dbRows } = await supabase
        .from("ad_adsets")
        .select("adset_id, name, status, campaign_id, fb_created_time, is_tracked")
        .in("campaign_id", Array.from(trackedCamps));
      const entities = (dbRows ?? [])
        .map((r) => ({
          entity_id: r.adset_id,
          name: r.name,
          status: r.status,
          parent_id: r.campaign_id,
          created_time: r.fb_created_time,
          thumbnail_url: null,
          is_tracked: r.is_tracked,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          link_clicks: 0,
          lpv: 0,
          initiate_checkout: 0,
          sales: 0,
          revenue: 0,
        }))
        .sort((a, b) => (b.created_time ?? "").localeCompare(a.created_time ?? ""));
      return NextResponse.json({ entities, stale: true });
    }

    // insights agregados por adset
    const insRes = await fetch(
      `${GRAPH}/${acct}/insights?level=adset&${tr}&fields=adset_id,spend,impressions,reach,clicks,actions,action_values&limit=500&access_token=${encodeURIComponent(token)}`
    );
    const ins = await insRes.json();
    const byId = new Map<string, any>();
    for (const r of ins.data ?? []) byId.set(r.adset_id, r);

    const entities = (list.data ?? [])
      .filter((a: any) => trackedCamps.has(a.campaign_id))
      .map((a: any) => {
        const m = byId.get(a.id) ?? {};
        return {
          entity_id: a.id,
          name: a.name,
          status: a.status,
          parent_id: a.campaign_id,
          created_time: a.created_time,
          thumbnail_url: null,
          ...metrics(m),
        };
      });

    // upsert preservando is_tracked
    if (entities.length) {
      await supabase.from("ad_adsets").upsert(
        entities.map((e: any) => ({
          user_id: user.id,
          ad_account_id: acct,
          campaign_id: e.parent_id,
          adset_id: e.entity_id,
          name: e.name,
          status: e.status,
          fb_created_time: e.created_time,
        })),
        { onConflict: "user_id,adset_id" }
      );
    }
    return NextResponse.json({ entities: await withTracked(supabase, "ad_adsets", "adset_id", entities) });
  }

  if (level === "ads") {
    // conjuntos ativados
    const { data: sets } = await supabase
      .from("ad_adsets")
      .select("adset_id")
      .eq("is_tracked", true);
    const trackedSets = new Set((sets ?? []).map((s) => s.adset_id));
    // Se ainda não há dados de conjuntos, não filtra por conjunto
    const filterBySets = trackedSets.size > 0;

    const listRes = await fetch(
      `${GRAPH}/${acct}/ads?fields=id,name,status,adset_id,campaign_id,created_time,creative%7Bthumbnail_url,image_url%7D&limit=500&access_token=${encodeURIComponent(token)}`
    );
    const list = await listRes.json();
    // Fallback: Meta indisponível (rate limit) -> devolve do banco
    if (list.error) {
      const { data: dbRows } = await supabase
        .from("ad_ads")
        .select("ad_id, name, status, adset_id, campaign_id, thumbnail_url, image_url, fb_created_time, is_tracked");
      const entities = (dbRows ?? [])
        .filter(
          (r: any) =>
            (!filterBySets || trackedSets.has(r.adset_id)) &&
            trackedCamps.has(r.campaign_id)
        )
        .map((r: any) => ({
          entity_id: r.ad_id,
          name: r.name,
          status: r.status,
          parent_id: r.adset_id,
          created_time: r.fb_created_time,
          thumbnail_url: r.thumbnail_url,
          image_url: r.image_url,
          is_tracked: r.is_tracked,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          link_clicks: 0,
          lpv: 0,
          initiate_checkout: 0,
          sales: 0,
          revenue: 0,
        }))
        .sort((a: any, b: any) =>
          (b.created_time ?? "").localeCompare(a.created_time ?? "")
        );
      return NextResponse.json({ entities, stale: true });
    }

    const insRes = await fetch(
      `${GRAPH}/${acct}/insights?level=ad&${tr}&fields=ad_id,spend,impressions,reach,clicks,actions,action_values&limit=500&access_token=${encodeURIComponent(token)}`
    );
    const ins = await insRes.json();
    const byId = new Map<string, any>();
    for (const r of ins.data ?? []) byId.set(r.ad_id, r);

    const entities = (list.data ?? [])
      .filter(
        (a: any) =>
          (!filterBySets || trackedSets.has(a.adset_id)) &&
          trackedCamps.has(a.campaign_id)
      )
      .map((a: any) => {
        const m = byId.get(a.id) ?? {};
        return {
          entity_id: a.id,
          name: a.name,
          status: a.status,
          parent_id: a.adset_id,
          campaign_id: a.campaign_id,
          created_time: a.created_time,
          thumbnail_url: a.creative?.thumbnail_url ?? null,
          image_url: a.creative?.image_url ?? null,
          ...metrics(m),
        };
      });

    if (entities.length) {
      await supabase.from("ad_ads").upsert(
        entities.map((e: any) => ({
          user_id: user.id,
          ad_account_id: acct,
          campaign_id: e.campaign_id,
          adset_id: e.parent_id,
          ad_id: e.entity_id,
          name: e.name,
          status: e.status,
          thumbnail_url: e.thumbnail_url,
          image_url: e.image_url,
          fb_created_time: e.created_time,
        })),
        { onConflict: "user_id,ad_id" }
      );
    }
    return NextResponse.json({ entities: await withTracked(supabase, "ad_ads", "ad_id", entities) });
  }

  return NextResponse.json({ error: "nível inválido" }, { status: 400 });
}

// PATCH /api/funnel/adsets|ads  body {id, is_tracked}
export async function PATCH(
  req: Request,
  { params }: { params: { level: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const table = params.level === "ads" ? "ad_ads" : "ad_adsets";
  const idCol = params.level === "ads" ? "ad_id" : "adset_id";
  const body = await req.json().catch(() => ({}));

  const { error } = await supabase
    .from(table)
    .update({ is_tracked: Boolean(body.is_tracked) })
    .eq(idCol, String(body.entity_id));

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

function metrics(m: any) {
  return {
    spend: Number(m.spend ?? 0),
    impressions: Number(m.impressions ?? 0),
    reach: Number(m.reach ?? 0),
    clicks: Number(m.clicks ?? 0),
    link_clicks: av(m.actions, "link_click"),
    lpv: av(m.actions, "landing_page_view"),
    initiate_checkout: sum(m.actions, CHECKOUT_TYPES),
    sales: sum(m.actions, PURCHASE_TYPES),
    revenue: sum(m.action_values, PURCHASE_TYPES),
  };
}

// junta o is_tracked salvo no banco
async function withTracked(
  supabase: any,
  table: string,
  idCol: string,
  entities: any[]
) {
  const { data } = await supabase.from(table).select(`${idCol}, is_tracked`);
  const map = new Map((data ?? []).map((r: any) => [r[idCol], r.is_tracked]));
  return entities
    .map((e) => ({ ...e, is_tracked: map.get(e.entity_id) ?? true }))
    .sort((a, b) => (b.created_time ?? "").localeCompare(a.created_time ?? ""));
}
