import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/funnel/adsets|ads?since=&until=  -> lê do BANCO (instantâneo)
export async function GET(
  req: Request,
  { params }: { params: { level: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");

  // Soma feita NO BANCO (função SQL com GROUP BY) -> sem limite de 1000 linhas.
  const fn = params.level === "ads" ? "funnel_ads" : "funnel_adsets";
  const { data, error } = await supabase.rpc(fn, {
    p_since: since,
    p_until: until,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const entities = (data ?? []).map((e: any) => ({
    entity_id: e.entity_id,
    name: e.name,
    status: e.status,
    parent_id: e.parent_id,
    thumbnail_url: e.thumbnail_url ?? null,
    image_url: e.image_url ?? null,
    is_tracked: e.is_tracked,
    spend: Number(e.spend),
    impressions: Number(e.impressions),
    reach: Number(e.reach),
    clicks: Number(e.clicks),
    link_clicks: Number(e.link_clicks),
    lpv: Number(e.lpv),
    initiate_checkout: Number(e.initiate_checkout),
    sales: Number(e.sales),
    revenue: Number(e.revenue),
  }));
  return NextResponse.json({ entities });
}

// PATCH /api/funnel/adsets|ads  body {entity_id, is_tracked}
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
