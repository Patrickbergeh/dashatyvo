"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { ThemeToggle } from "@/components/theme-toggle";
import { KpiCard } from "@/components/kpi-card";
import { SpendChart, type ChartPoint } from "@/components/spend-chart";
import { CampaignsPanel } from "@/components/campaigns-panel";
import { FunnelPanel, type FunnelEntity } from "@/components/funnel-panel";
import { FunnelChart, type FunnelSegment } from "@/components/funnel-chart";
import { CreativeThumb } from "@/components/creative-thumb";
import { AnimatedNumber } from "@/components/animated-number";
import { Segmented } from "@/components/segmented";
import { DateRangePicker, type Range } from "@/components/date-range-picker";

type Level = "campaign" | "adset" | "ad";

const FUNNEL: [Level, string][] = [
  ["campaign", "Campanha"],
  ["adset", "Conjunto"],
  ["ad", "Anúncio"],
];

type Metric = {
  date: string;
  campaign_name: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  link_clicks: number;
  landing_page_views: number;
  initiate_checkout: number;
  sales: number;
  revenue: number;
};

type GreenSale = {
  sale_id: string;
  amount_gross: number;
  amount_net: number;
  fee: number;
  paid_at: string | null;
  approved: boolean;
};

// Novos impostos da Meta sobre anúncios no Brasil (a partir de 01/2026):
// PIS/Cofins 9,25% + ISS 2,9% = 12,15% sobre o valor gasto.
const META_TAX = 0.1215;

type Preset = "hoje" | "ontem" | "7d" | "30d" | "max" | "custom";

const PRESETS: [Preset, string][] = [
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["7d", "7 dias"],
  ["30d", "30 dias"],
  ["max", "Máximo"],
];

const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function presetRange(preset: Preset): Range {
  const today = new Date();
  if (preset === "hoje") return { start: isoDate(today), end: isoDate(today) };
  if (preset === "ontem") {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return { start: isoDate(y), end: isoDate(y) };
  }
  if (preset === "7d") {
    const s = new Date();
    s.setDate(s.getDate() - 6);
    return { start: isoDate(s), end: isoDate(today) };
  }
  if (preset === "30d") {
    const s = new Date();
    s.setDate(s.getDate() - 29);
    return { start: isoDate(s), end: isoDate(today) };
  }
  return { start: null, end: null }; // máximo
}

const fmtBR = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: number) => Math.round(v).toLocaleString("pt-BR");
const pct = (v: number) => `${v.toFixed(2)}%`;
const roasFmt = (v: number) => `${v.toFixed(2)}x`;
const dec2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DashboardClient({ email }: { email: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [greenSales, setGreenSales] = useState<GreenSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState<Range>(presetRange("30d"));
  const [showPicker, setShowPicker] = useState(false);
  const [level, setLevel] = useState<Level>("campaign");

  // Restaura o nível salvo ao carregar a página
  useEffect(() => {
    const saved = localStorage.getItem("dash_level");
    if (saved === "adset" || saved === "ad") setLevel(saved as Level);
  }, []);

  // Troca de nível e persiste (só em ação do usuário -> sem sobrescrever ao carregar)
  const changeLevel = useCallback((lvl: Level) => {
    setLevel(lvl);
    try {
      localStorage.setItem("dash_level", lvl);
    } catch {
      /* ignora */
    }
  }, []);
  // cache por nível: troca instantânea, atualiza em segundo plano (sem piscar)
  const [funnelCache, setFunnelCache] = useState<{
    adset: FunnelEntity[];
    ad: FunnelEntity[];
  }>({ adset: [], ad: [] });
  const [funnelFetched, setFunnelFetched] = useState<{
    adset: boolean;
    ad: boolean;
  }>({ adset: false, ad: false });

  // Alcance DEDUPLICADO do período (a Meta calcula; não dá pra somar por dia)
  const [reachData, setReachData] = useState<{
    total: number;
    byId: Record<string, number>;
  } | null>(null);

  const funnel = level === "campaign" ? [] : funnelCache[level];

  const loadMetrics = useCallback(async () => {
    // só as campanhas ativadas (is_tracked) entram nos números
    const { data: tracked } = await supabase
      .from("ad_campaigns")
      .select("campaign_id")
      .eq("is_tracked", true);
    const ids = new Set((tracked ?? []).map((t) => t.campaign_id));

    const { data } = await supabase
      .from("ad_metrics")
      .select(
        "date, campaign_id, campaign_name, spend, clicks, impressions, reach, link_clicks, landing_page_views, initiate_checkout, sales, revenue"
      )
      .order("date", { ascending: true });

    const rows = ((data as (Metric & { campaign_id: string })[]) ?? []).filter(
      (m) => ids.has(m.campaign_id)
    );
    setMetrics(rows);

    // Vendas aprovadas vindas da Green
    const { data: green } = await supabase
      .from("green_sales")
      .select("sale_id, amount_gross, amount_net, fee, paid_at, approved")
      .eq("approved", true);
    setGreenSales((green as GreenSale[]) ?? []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Ao ABRIR e a cada 2 min enquanto aberta: puxa AO VIVO da Meta pro banco
  // (campanhas + conjuntos + anúncios) e recarrega os KPIs. Assim quem está com a
  // plataforma aberta vê os números atuais; o cron de 15min só cobre quando
  // ninguém está olhando.
  useEffect(() => {
    let alive = true;
    const syncLive = async () => {
      try {
        await Promise.all([
          fetch("/api/campaigns/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ days: 30 }),
          }),
          fetch("/api/funnel/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ days: 30 }),
          }),
        ]);
        if (!alive) return;
        await loadMetrics(); // re-lê os KPIs do banco já atualizado
        setFunnelFetched({ adset: false, ad: false }); // re-lê conjuntos/anúncios
      } catch {
        /* silencioso — segue com o que já está no banco */
      }
    };
    syncLive();
    const id = setInterval(syncLive, 120_000); // 2 min
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Puxa o alcance real (deduplicado) do período/nível direto da Meta
  useEffect(() => {
    const qs = new URLSearchParams({ level });
    if (range.start) qs.set("since", range.start);
    if (range.end) qs.set("until", range.end);
    (async () => {
      try {
        const res = await fetch(`/api/reach?${qs.toString()}`, { cache: "no-store" });
        const j = await res.json();
        if (res.ok) setReachData({ total: Number(j.total ?? 0), byId: j.byId ?? {} });
      } catch {
        /* mantém o anterior */
      }
    })();
  }, [level, range]);

  const filtered = useMemo(() => {
    return metrics.filter((m) => {
      if (range.start && m.date < range.start) return false;
      if (range.end && m.date > range.end) return false;
      return true;
    });
  }, [metrics, range]);

  // Vendas aprovadas da Green dentro do período
  const green = useMemo(() => {
    const rows = greenSales.filter((s) => {
      const d = (s.paid_at ?? "").slice(0, 10);
      if (range.start && d < range.start) return false;
      if (range.end && d > range.end) return false;
      return true;
    });
    return {
      count: rows.length,
      revenue: rows.reduce((a, s) => a + Number(s.amount_gross), 0),
      // taxa total cobrada pela Green no período
      fee: rows.reduce((a, s) => a + Number(s.fee), 0),
      byDay: rows.reduce<Record<string, number>>((acc, s) => {
        const d = (s.paid_at ?? "").slice(0, 10);
        acc[d] = (acc[d] ?? 0) + Number(s.amount_gross);
        return acc;
      }, {}),
    };
  }, [greenSales, range]);

  const k = useMemo(() => {
    const t = filtered.reduce(
      (a, m) => ({
        spend: a.spend + Number(m.spend),
        clicks: a.clicks + Number(m.clicks),
        impressions: a.impressions + Number(m.impressions),
        reach: a.reach + Number(m.reach ?? 0),
        link_clicks: a.link_clicks + Number(m.link_clicks ?? 0),
        lpv: a.lpv + Number(m.landing_page_views ?? 0),
        initiate_checkout: a.initiate_checkout + Number(m.initiate_checkout ?? 0),
      }),
      { spend: 0, clicks: 0, impressions: 0, reach: 0, link_clicks: 0, lpv: 0, initiate_checkout: 0 }
    );
    // vendas e receita vêm da Green (vendas aprovadas)
    const sales = green.count;
    const revenue = green.revenue;
    return {
      ...t,
      sales,
      revenue,
      roas: t.spend > 0 ? revenue / t.spend : 0,
      cpc: t.link_clicks > 0 ? t.spend / t.link_clicks : 0,
      cpa: sales > 0 ? t.spend / sales : 0,
      cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0,
      ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
      frequency: t.reach > 0 ? t.impressions / t.reach : 0,
      connectRate: t.link_clicks > 0 ? (t.lpv / t.link_clicks) * 100 : 0,
      cpv: t.lpv > 0 ? t.spend / t.lpv : 0,
      conv: t.lpv > 0 ? (sales / t.lpv) * 100 : 0,
    };
  }, [filtered, green]);

  // Busca um nível e guarda no cache.
  // IMPORTANTE: em caso de erro (ex.: rate limit da Meta) NÃO limpa o cache,
  // mantém os dados que já estavam na tela.
  const fetchLevel = useCallback(
    async (lvl: "adset" | "ad") => {
      const qs = new URLSearchParams();
      if (range.start) qs.set("since", range.start);
      if (range.end) qs.set("until", range.end);
      const path = lvl === "adset" ? "adsets" : "ads";
      try {
        const res = await fetch(`/api/funnel/${path}?${qs.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (res.ok && Array.isArray(json.entities)) {
          setFunnelCache((prev) => ({ ...prev, [lvl]: json.entities }));
        }
      } catch {
        /* mantém o cache atual */
      } finally {
        setFunnelFetched((prev) => ({ ...prev, [lvl]: true }));
      }
    },
    [range]
  );

  // Pré-carrega conjuntos e anúncios em 2º plano -> troca de nível instantânea.
  // Cada nível é buscado 1x por período (cache), sequencial pra não sobrecarregar.
  useEffect(() => {
    if (!funnelFetched.adset) {
      fetchLevel("adset");
      return;
    }
    if (!funnelFetched.ad) fetchLevel("ad");
  }, [funnelFetched.adset, funnelFetched.ad, fetchLevel]);

  // Ao mudar o período, marca os níveis como não-buscados (revalida ao visitar)
  useEffect(() => {
    setFunnelFetched({ adset: false, ad: false });
  }, [range]);

  async function toggleFunnel(e: FunnelEntity) {
    if (level === "campaign") return;
    const lvl = level;
    const next = !e.is_tracked;
    setFunnelCache((prev) => ({
      ...prev,
      [lvl]: prev[lvl].map((x) =>
        x.entity_id === e.entity_id ? { ...x, is_tracked: next } : x
      ),
    }));
    const path = lvl === "adset" ? "adsets" : "ads";
    await fetch(`/api/funnel/${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: e.entity_id, is_tracked: next }),
    });
    const tipo = lvl === "adset" ? "conjunto" : "anúncio";
    logActivity(`${next ? "Ativou" : "Desativou"} ${tipo} "${e.name}"`);
    // desativar um conjunto muda os anúncios -> revalida o cache de anúncios
    if (lvl === "adset") setFunnelFetched((prev) => ({ ...prev, ad: false }));
  }

  // KPIs exibidos conforme o nível selecionado
  const view = useMemo(() => {
    let b;
    if (level === "campaign") {
      b = k;
    } else {
      const t = funnel
        .filter((e) => e.is_tracked)
        .reduce(
          (a, e) => ({
            spend: a.spend + Number(e.spend),
            clicks: a.clicks + Number(e.clicks),
            impressions: a.impressions + Number(e.impressions),
            reach: a.reach + Number(e.reach),
            link_clicks: a.link_clicks + Number(e.link_clicks),
            lpv: a.lpv + Number(e.lpv),
            initiate_checkout: a.initiate_checkout + Number(e.initiate_checkout),
          }),
          { spend: 0, clicks: 0, impressions: 0, reach: 0, link_clicks: 0, lpv: 0, initiate_checkout: 0 }
        );
      const sales = green.count;
      const revenue = green.revenue;
      b = {
        ...t,
        sales,
        revenue,
        roas: t.spend > 0 ? revenue / t.spend : 0,
        cpc: t.link_clicks > 0 ? t.spend / t.link_clicks : 0,
        cpa: sales > 0 ? t.spend / sales : 0,
        cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0,
        ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
        frequency: t.reach > 0 ? t.impressions / t.reach : 0,
        connectRate: t.link_clicks > 0 ? (t.lpv / t.link_clicks) * 100 : 0,
        cpv: t.lpv > 0 ? t.spend / t.lpv : 0,
        conv: t.lpv > 0 ? (sales / t.lpv) * 100 : 0,
      };
    }
    // alcance deduplicado real (sobrescreve a soma diária) + frequência correta
    const reach = reachData ? reachData.total : b.reach;
    return {
      ...b,
      reach,
      frequency: reach > 0 ? b.impressions / reach : 0,
    };
  }, [level, k, funnel, green, reachData]);

  // Conversão bruta x líquida.
  // Líquida = venda bruta − taxa da Green − valor gasto COM impostos da Meta.
  const conv = useMemo(() => {
    const metaTax = view.spend * META_TAX;
    const spendWithTax = view.spend + metaTax; // gasto + imposto Meta 12,15%
    return {
      gross: green.revenue,
      net: green.revenue - green.fee - spendWithTax,
      greenFee: green.fee,
      metaTax,
      spendWithTax,
    };
  }, [green, view.spend]);

  // Funil (topo -> base) com as métricas do nível/período atual
  const funnelSegments: FunnelSegment[] = useMemo(
    () => [
      { label: "Impressões", value: view.impressions, format: num },
      { label: "Alcance", value: view.reach, format: num },
      { label: "Frequência", value: view.frequency, format: dec2 },
      { label: "CTR", value: view.ctr, format: pct },
      { label: "Cliques no link", value: view.link_clicks, format: num },
      { label: "Visualizações da página", value: view.lpv, format: num },
      { label: "Initiate checkout", value: view.initiate_checkout, format: num },
      { label: "Compras", value: view.sales, format: num },
      { label: "Custo por compra", value: view.cpa, format: brl },
      { label: "ROAS", value: view.roas, format: roasFmt },
    ],
    [view]
  );

  const chart: ChartPoint[] = useMemo(() => {
    const byDay = new Map<string, ChartPoint>();
    for (const m of filtered) {
      const key = m.date;
      const cur = byDay.get(key) ?? { date: fmtDay(key), spend: 0, revenue: 0 };
      cur.spend += Number(m.spend);
      byDay.set(key, cur);
    }
    // receita = vendas aprovadas da Green por dia
    for (const [day, rev] of Object.entries(green.byDay)) {
      const cur = byDay.get(day) ?? { date: fmtDay(day), spend: 0, revenue: 0 };
      cur.revenue += rev;
      byDay.set(day, cur);
    }
    return Array.from(byDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [filtered, green]);

  async function logout() {
    await logActivity("Saiu da plataforma");
    await supabase.auth.signOut();
    router.push("/login");
  }

  // skeleton só na 1ª carga do nível (sem cache); depois troca instantânea
  const funnelFirstLoad =
    level !== "campaign" && !funnelFetched[level] && funnel.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-bg xl:h-screen xl:overflow-hidden">
      {/* Topo minimalista — sem logo/nome */}
      <header className="sticky top-0 z-20 shrink-0 border-b border-line bg-bg/80 backdrop-blur">
        <div className="grid w-full grid-cols-3 items-center px-6 py-3.5">
          <div className="flex items-center gap-2 justify-self-start">
            <span className="text-sm font-bold uppercase text-brand">cliente</span>
            <span className="text-sm font-bold uppercase text-fg">leandro &amp; carol mançur</span>
          </div>

          <div className="relative justify-self-center">
          <Segmented
            options={PRESETS}
            value={preset === "custom" ? null : preset}
            onChange={(k) => {
              setPreset(k);
              setRange(presetRange(k));
              setShowPicker(false);
            }}
            extra={
              <>
                <button
                  onClick={() => setShowPicker((s) => !s)}
                  className={`relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 font-bold transition-colors ${
                    preset === "custom" ? "bg-brand text-black" : "text-muted hover:text-fg"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {preset === "custom" && range.start
                    ? `${fmtBR(range.start)} — ${fmtBR(range.end ?? range.start)}`
                    : "Personalizado"}
                </button>
                {showPicker && (
                  <DateRangePicker
                    value={range.start ? range : presetRange("30d")}
                    onApply={(r) => {
                      setRange(r);
                      setPreset("custom");
                      setShowPicker(false);
                    }}
                    onClose={() => setShowPicker(false)}
                  />
                )}
              </>
            }
          />
          </div>

          <div className="flex items-center gap-3 justify-self-end">
            <ThemeToggle />
            <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-black">
                {email.charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-xs font-bold text-fg sm:block">
                {email}
              </span>
            </div>
            <button
              onClick={logout}
              aria-label="Sair"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-negative"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex w-full flex-col px-6 py-7 xl:min-h-0 xl:flex-1 xl:py-5">
        {/* Funil: Campanha › Conjunto › Anúncio + botão Histórico */}
        <div className="mb-6 flex shrink-0 items-center justify-between gap-3">
          <Segmented
            options={FUNNEL}
            value={level}
            chevron
            onChange={(k) => {
              changeLevel(k);
              if (k !== "campaign")
                logActivity(`Acessou ${k === "adset" ? "conjuntos" : "anúncios"}`);
            }}
          />

          <Link
            href="/dashboard/historico"
            className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-muted transition-colors hover:text-fg"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v5h5" />
              <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
              <path d="M12 7v5l4 2" />
            </svg>
            Histórico
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_440px_340px]">
          <section className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
            {(level === "campaign" ? loading : funnelFirstLoad) ? (
              <SkeletonGrid />
            ) : (
              <>
                {/* TABELA (campanhas / conjuntos / anúncios) no topo */}
                {level === "campaign" ? (
                  <CampaignTable metrics={filtered} />
                ) : (
                  <FunnelTable
                    level={level}
                    entities={funnel.filter((e) => e.is_tracked)}
                  />
                )}

                {/* VENDAS */}
                <SectionTitle>Vendas</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <KpiCard label="Vendas aprovadas" value={<AnimatedNumber value={view.sales} format={num} />} hint={`via Green · ${brl(view.revenue)}`} icon={<CartIcon />} accent />
                  <KpiCard label="Taxa de conversão" value={<AnimatedNumber value={view.conv} format={pct} />} hint="Vendas / visualizações da página" icon={<PercentIcon />} />
                  <KpiCard label="Initiate Checkout" value={<AnimatedNumber value={view.initiate_checkout} format={num} />} hint="Checkouts iniciados" icon={<CartIcon />} />
                </div>

                {/* FINANCEIRO */}
                <SectionTitle>Financeiro</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <KpiCard label="Conversão bruta" value={<AnimatedNumber value={conv.gross} format={brl} />} hint="Valor bruto das vendas" icon={<CashIcon />} />
                  <KpiCard
                    label="Lucro real"
                    value={<AnimatedNumber value={conv.net} format={(v) => `${v < 0 ? "−" : ""}${brl(Math.abs(v))}`} />}
                    tone={conv.net >= 0 ? "positive" : "negative"}
                    badge={conv.net >= 0 ? "Lucro" : "Prejuízo"}
                    hint="Venda − taxa Green − gasto c/ imposto Meta"
                    icon={<CashIcon />}
                  />
                  <KpiCard label="ROAS" value={<AnimatedNumber value={view.roas} format={roasFmt} />} hint={`Receita ${brl(view.revenue)}`} icon={<TargetIcon />} />
                  <KpiCard label="CPA" value={<AnimatedNumber value={view.cpa} format={brl} />} hint="Custo por venda aprovada" icon={<UserIcon />} />
                </div>

                {/* INVESTIMENTO */}
                <SectionTitle>Investimento</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <KpiCard label="Valor gasto" value={<AnimatedNumber value={view.spend} format={brl} />} hint="Investimento total no período" icon={<WalletIcon />} />
                  <KpiCard label="Gasto c/ imposto Meta" value={<AnimatedNumber value={conv.spendWithTax} format={brl} />} hint={`+ 12,15% de imposto (${brl(conv.metaTax)})`} icon={<WalletIcon />} />
                  <KpiCard label="CPC (link)" value={<AnimatedNumber value={view.cpc} format={brl} />} hint="Custo por clique no link" icon={<ClickIcon />} />
                  <KpiCard label="CPM" value={<AnimatedNumber value={view.cpm} format={brl} />} hint="Custo por mil impressões" icon={<EyeMetricIcon />} />
                  <KpiCard label="Custo por view de página" value={<AnimatedNumber value={view.cpv} format={brl} />} hint="Gasto ÷ visualizações da página" icon={<PageIcon />} />
                </div>

                {/* TRÁFEGO */}
                <SectionTitle>Tráfego</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <KpiCard label="Impressões" value={<AnimatedNumber value={view.impressions} format={num} />} hint="Total de exibições" icon={<EyeMetricIcon />} />
                  <KpiCard label="Alcance" value={<AnimatedNumber value={view.reach} format={num} />} hint="Pessoas alcançadas" icon={<UserIcon />} />
                  <KpiCard label="Frequência" value={<AnimatedNumber value={view.frequency} format={dec2} />} hint="Impressões ÷ alcance" icon={<PercentIcon />} />
                  <KpiCard label="CTR" value={<AnimatedNumber value={view.ctr} format={pct} />} hint="Cliques ÷ impressões" icon={<PercentIcon />} />
                  <KpiCard label="Cliques no link" value={<AnimatedNumber value={view.link_clicks} format={num} />} hint={`${num(view.clicks)} cliques totais`} icon={<ClickIcon />} />
                  <KpiCard label="Visualizações da página" value={<AnimatedNumber value={view.lpv} format={num} />} hint="Landing page views" icon={<PageIcon />} />
                  <KpiCard label="Connect Rate" value={<AnimatedNumber value={view.connectRate} format={pct} />} hint="Visualizações da página ÷ cliques no link" icon={<PercentIcon />} />
                </div>

                <div className="mt-6">
                  <SpendChart data={chart} />
                </div>
              </>
            )}
          </section>

          {/* Coluna do funil (do lado do painel) */}
          <aside className="min-w-0 xl:min-h-0">
            <div className="h-full">
              <FunnelChart segments={funnelSegments} />
            </div>
          </aside>

          {/* Coluna lateral: muda conforme o nível */}
          <aside className="min-w-0 xl:min-h-0">
            <div className="h-full">
              {level === "campaign" ? (
                <CampaignsPanel onSynced={loadMetrics} />
              ) : (
                <FunnelPanel
                  level={level}
                  entities={funnel}
                  loading={funnelFirstLoad}
                  onToggle={toggleFunnel}
                />
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SectionTitle({
  children,
  first,
}: {
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div className={`mb-3 flex items-center gap-2 ${first ? "" : "mt-7"}`}>
      <span className="h-4 w-1 rounded-full bg-brand" />
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
        {children}
      </h2>
    </div>
  );
}

// Métricas derivadas por linha (usadas nas tabelas de campanha/conjunto/anúncio)
type RowRaw = {
  spend: number;
  revenue: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  lpv: number;
  sales: number;
};
function derive(r: RowRaw) {
  const spend = Number(r.spend),
    rev = Number(r.revenue),
    imp = Number(r.impressions),
    reach = Number(r.reach),
    clicks = Number(r.clicks),
    lc = Number(r.link_clicks),
    lpv = Number(r.lpv),
    sales = Number(r.sales);
  return {
    sales,
    lucro: rev - spend * (1 + META_TAX), // lucro real (receita − gasto c/ imposto)
    spend,
    imp,
    reach,
    freq: reach > 0 ? imp / reach : 0,
    ctr: imp > 0 ? (clicks / imp) * 100 : 0,
    cpc: lc > 0 ? spend / lc : 0,
    cpm: imp > 0 ? (spend / imp) * 1000 : 0,
    cpv: lpv > 0 ? spend / lpv : 0, // custo por visualização de página
  };
}
function MetricHeaders() {
  return (
    <>
      <th className="px-4 py-3">Vendas</th>
      <th className="px-4 py-3">Lucro real</th>
      <th className="px-4 py-3">Gasto</th>
      <th className="px-4 py-3">Impressões</th>
      <th className="px-4 py-3">Alcance</th>
      <th className="px-4 py-3">Freq.</th>
      <th className="px-4 py-3">CTR</th>
      <th className="px-4 py-3">CPC</th>
      <th className="px-4 py-3">CPM</th>
      <th className="px-4 py-3">Custo/view</th>
    </>
  );
}
function MetricCells({ m }: { m: ReturnType<typeof derive> }) {
  return (
    <>
      <td className="whitespace-nowrap px-4 py-3 text-fg">{num(m.sales)}</td>
      <td
        className={`whitespace-nowrap px-4 py-3 font-bold ${
          m.lucro >= 0 ? "text-positive" : "text-negative"
        }`}
      >
        {`${m.lucro < 0 ? "−" : ""}${brl(Math.abs(m.lucro))}`}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-fg">{brl(m.spend)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-fg">{num(m.imp)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-fg">{num(m.reach)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-fg">{m.freq.toFixed(2)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-fg">{pct(m.ctr)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-fg">{brl(m.cpc)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-fg">{brl(m.cpm)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-fg">{brl(m.cpv)}</td>
    </>
  );
}

// Eficiência do anúncio (diagnóstico de relevância da Meta)
function EffBadge({ value }: { value?: string | null }) {
  if (!value || value === "UNKNOWN")
    return <span className="text-xs font-bold text-muted">—</span>;
  let label = "Abaixo da média";
  let cls = "bg-negative/10 text-negative";
  if (value === "above_average") {
    label = "Acima da média";
    cls = "bg-positive/10 text-positive";
  } else if (value === "average") {
    label = "Na média";
    cls = "bg-muted/15 text-fg";
  }
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

function FunnelTable({
  level,
  entities,
}: {
  level: "adset" | "ad";
  entities: FunnelEntity[];
}) {
  const rows = [...entities].sort((a, b) => b.spend - a.spend);
  // top desempenho: mais cliques no link + visualizações da página
  const topId = rows.reduce(
    (best, e) => {
      const score = Number(e.link_clicks) + Number(e.lpv);
      return score > best.score ? { id: e.entity_id, score } : best;
    },
    { id: "", score: 0 }
  ).id;
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <h3 className="text-base font-bold text-fg">
          {level === "adset" ? "Conjuntos" : "Anúncios"} ativos
        </h3>
      </div>
      <div className="h-[420px] overflow-auto">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Nenhum {level === "adset" ? "conjunto" : "anúncio"} ativo no período.
          </div>
        ) : (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="text-left text-xs font-bold text-muted">
              <th className="px-5 py-3">{level === "adset" ? "Conjunto" : "Anúncio"}</th>
              {level === "ad" && <th className="px-4 py-3">Eficiência</th>}
              <MetricHeaders />
              <th className="px-4 py-3">Cliques no link</th>
              <th className="px-4 py-3">Views</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => {
              const m = derive(e);
              return (
                <tr key={e.entity_id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {level === "ad" && (
                        <>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-black">
                            {i + 1}
                          </span>
                          <CreativeThumb url={e.thumbnail_url} full={e.image_url} size={36} />
                        </>
                      )}
                      <span className="max-w-[180px] truncate font-bold text-fg">{e.name}</span>
                      {e.entity_id === topId && <FireIcon />}
                    </div>
                  </td>
                  {level === "ad" && (
                    <td className="px-4 py-3">
                      <EffBadge value={e.quality_ranking} />
                    </td>
                  )}
                  <MetricCells m={m} />
                  <td className="whitespace-nowrap px-4 py-3 text-fg">{num(e.link_clicks)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-fg">{num(e.lpv)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

function CampaignTable({ metrics }: { metrics: Metric[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, RowRaw & { link_clicks: number }>();
    for (const m of metrics) {
      const key = m.campaign_name || "Sem campanha";
      const cur =
        map.get(key) ??
        {
          spend: 0,
          revenue: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          link_clicks: 0,
          lpv: 0,
          sales: 0,
        };
      cur.spend += Number(m.spend);
      cur.revenue += Number(m.revenue);
      cur.impressions += Number(m.impressions);
      cur.reach += Number(m.reach ?? 0);
      cur.clicks += Number(m.clicks);
      cur.link_clicks += Number(m.link_clicks ?? 0);
      cur.lpv += Number(m.landing_page_views ?? 0);
      cur.sales += Number(m.sales);
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.spend - a.spend);
  }, [metrics]);

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <h3 className="text-base font-bold text-fg">Campanhas</h3>
      </div>
      <div className="h-[420px] overflow-auto">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Nenhuma campanha ativa no período.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="text-left text-xs font-bold text-muted">
                <th className="px-5 py-3">Campanha</th>
                <MetricHeaders />
                <th className="px-4 py-3">Cliques no link</th>
                <th className="px-4 py-3">Views</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = derive(r);
                return (
                  <tr key={r.name} className="border-t border-line">
                    <td className="px-5 py-3">
                      <span className="block max-w-[220px] truncate font-bold text-fg">
                        {r.name}
                      </span>
                    </td>
                    <MetricCells m={m} />
                    <td className="whitespace-nowrap px-4 py-3 text-fg">{num(r.link_clicks)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-fg">{num(r.lpv)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-black">
        <TargetIcon />
      </div>
      <h3 className="text-lg font-bold text-fg">Nenhum dado ainda</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Conecte sua conta do Meta Ads ou receba dados pelo webhook para ver seus
        KPIs aqui. Você pode popular dados de exemplo com o seed SQL incluído.
      </p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[150px] animate-pulse rounded-2xl border border-line bg-surface"
        />
      ))}
    </div>
  );
}

function fmtDay(d: string) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

// Ícones
function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}
function ClickIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9l5 12 1.8-5.2L21 14 9 9z" /><path d="M7.2 2.2 8 5.1M5.1 8 2.2 7.2M14 4.1 12.5 6.5M4.1 14 6.5 12.5" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function PercentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 5 5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}
function EyeMetricIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function FireIcon() {
  return (
    <span title="Mais cliques e visualizações" className="shrink-0 leading-none">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path
          fill="#f97316"
          d="M12 23c-4.4 0-8-3.2-8-7.4 0-2.7 1.4-5 2.9-6.7C8.2 7.3 9.7 5.4 9.2 2c3.1 1.4 5.3 4.1 5.3 6.6 0 .9-.2 1.7-.6 2.4.8-.4 1.4-1.2 1.7-2.2 1.9 1.6 3.4 4 3.4 6.8C19 19.8 16.4 23 12 23z"
        />
        <path
          fill="#fbbf24"
          d="M12 20.6c-2.1 0-3.8-1.5-3.8-3.6 0-1.6 1.1-2.9 2-3.9.2 1 .8 1.7 1.6 2-.4-1.7.3-3.4 1.4-4.4 1.1 1.1 2.4 2.7 2.4 4.6 0 2.6-1.6 5.3-3.6 5.3z"
        />
      </svg>
    </span>
  );
}
function CashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}
function PageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}
