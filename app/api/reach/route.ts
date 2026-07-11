import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GRAPH = "https://graph.facebook.com/v20.0";

// Alcance DEDUPLICADO do período (a Meta calcula; não dá pra somar por dia).
// GET /api/reach?level=campaign|adset|ad&since=&until=
// Retorna { total, byId: { [entityId]: reach } }
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const level = url.searchParams.get("level") ?? "campaign";
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");

  const { data: integ } = await supabase
    .from("facebook_integrations")
    .select("ad_account_id, access_token")
    .eq("is_active", true)
    .limit(1)
    .single();
  if (!integ?.access_token) return NextResponse.json({ total: 0, byId: {} });
  const acct = integ.ad_account_id;
  const token = encodeURIComponent(integ.access_token);

  const { data: camps } = await supabase
    .from("ad_campaigns")
    .select("campaign_id")
    .eq("is_tracked", true);
  const tracked = (camps ?? []).map((c) => c.campaign_id);
  if (tracked.length === 0) return NextResponse.json({ total: 0, byId: {} });

  const tr =
    since && until
      ? `time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
      : "date_preset=maximum";
  const filtering = encodeURIComponent(
    JSON.stringify([
      { field: "campaign.id", operator: "IN", value: tracked },
    ])
  );

  // total deduplicado (nível conta, filtrado pelas campanhas ativas)
  let total = 0;
  try {
    const res = await fetch(
      `${GRAPH}/${acct}/insights?${tr}&filtering=${filtering}&fields=reach&access_token=${token}`
    );
    const j = await res.json();
    if (!j.error) total = Number(j.data?.[0]?.reach ?? 0);
  } catch {
    /* ignora */
  }

  // por entidade (reach deduplicado de cada uma no período)
  const idField =
    level === "ad" ? "ad_id" : level === "adset" ? "adset_id" : "campaign_id";
  const byId: Record<string, number> = {};
  try {
    const res = await fetch(
      `${GRAPH}/${acct}/insights?level=${level}&${tr}&filtering=${filtering}&fields=${idField},reach&limit=1000&access_token=${token}`
    );
    let j = await res.json();
    let next: string | null = null;
    do {
      if (j.error) break;
      for (const r of j.data ?? []) byId[r[idField]] = Number(r.reach ?? 0);
      next = j.paging?.next ?? null;
      if (next) j = await (await fetch(next)).json();
    } while (next);
  } catch {
    /* ignora */
  }

  return NextResponse.json({ total, byId });
}
