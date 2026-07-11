"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logActivity } from "@/lib/activity";

type Campaign = {
  id: string;
  ad_account_id: string;
  campaign_id: string;
  campaign_name: string | null;
  status: string | null;
  objective: string | null;
  is_tracked: boolean;
  fb_created_time: string | null;
};

type Filter = "all" | "active" | "paused" | "tracked";

export function CampaignsPanel({ onSynced }: { onSynced?: () => void }) {
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/campaigns");
    const json = await res.json();
    setItems(json.campaigns ?? []);
    setLoading(false);
  }, []);

  // Sincroniza silenciosamente (sem avisos) e atualiza o dashboard
  const silentSync = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      });
      if (res.ok) onSynced?.();
    } catch {
      /* silencioso */
    }
  }, [onSynced]);

  // Carrega a lista (do banco, barato) ao abrir e quando a aba volta ao foco.
  // A sincronização com a Meta (cara) roda só 1x ao abrir — evita rate limit.
  useEffect(() => {
    load();
    silentSync();
    const onActive = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onActive);
    document.addEventListener("visibilitychange", onActive);
    return () => {
      window.removeEventListener("focus", onActive);
      document.removeEventListener("visibilitychange", onActive);
    };
  }, [load, silentSync]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (filter === "active" && c.status !== "ACTIVE") return false;
      if (filter === "paused" && c.status === "ACTIVE") return false;
      if (filter === "tracked" && !c.is_tracked) return false;
      if (q && !(c.campaign_name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, filter]);

  const activeCount = items.filter((c) => c.status === "ACTIVE").length;
  const trackedCount = items.filter((c) => c.is_tracked).length;

  // Ao alternar: aplica no banco e dispara sync silencioso (debounce)
  function toggle(c: Campaign) {
    const next = !c.is_tracked;
    setItems((prev) =>
      prev.map((p) => (p.id === c.id ? { ...p, is_tracked: next } : p))
    );
    fetch(`/api/campaigns/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_tracked: next }),
    });
    logActivity(
      `${next ? "Ativou" : "Desativou"} campanha "${c.campaign_name ?? c.campaign_id}"`
    );
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(silentSync, 800);
  }

  async function setAll(value: boolean) {
    const targets = filtered.filter((c) => c.is_tracked !== value);
    setItems((prev) =>
      prev.map((p) =>
        targets.find((t) => t.id === p.id) ? { ...p, is_tracked: value } : p
      )
    );
    await Promise.all(
      targets.map((c) =>
        fetch(`/api/campaigns/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_tracked: value }),
        })
      )
    );
    silentSync();
  }

  async function refresh() {
    setRefreshing(true);
    await fetch("/api/campaigns/refresh", { method: "POST" });
    await load();
    silentSync();
    setRefreshing(false);
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface xl:h-full">
      <div className="border-b border-line px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-fg">Campanhas</h3>
            <p className="text-xs text-muted">
              {activeCount} ativas no Facebook · {trackedCount} puxando
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={refresh}
              disabled={refreshing}
              aria-label="Atualizar"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-fg disabled:opacity-50"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={refreshing ? "animate-spin" : ""}
              >
                <path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-bg px-3">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--muted))" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar campanha..."
            className="w-full border-0 bg-transparent py-2 text-sm text-fg placeholder:text-muted"
          />
        </div>

        {/* Filtros — scroll horizontal para não quebrar no painel estreito */}
        <div className="mt-2.5 -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["all", "Todas"],
              ["tracked", "Puxando"],
              ["active", "Ativas"],
              ["paused", "Pausadas"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                filter === key
                  ? "bg-fg text-bg"
                  : "border border-line text-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="mx-0.5 h-4 w-px shrink-0 bg-line" />
          <button
            onClick={() => setAll(true)}
            className="shrink-0 whitespace-nowrap rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-muted transition-colors hover:text-fg"
          >
            Todas on
          </button>
          <button
            onClick={() => setAll(false)}
            className="shrink-0 whitespace-nowrap rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-muted transition-colors hover:text-fg"
          >
            Off
          </button>
        </div>
      </div>

      {/* Lista rolável (ordenada por data de criação, mais nova em cima) */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-line bg-bg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted">
            Nenhuma campanha encontrada.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => {
              const isActive = c.status === "ACTIVE";
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "bg-positive/12 text-positive"
                            : "bg-muted/12 text-muted"
                        }`}
                      >
                        {isActive ? "Ativa" : "Pausada"}
                      </span>
                      <p className="truncate text-xs font-bold text-fg">
                        {c.campaign_name}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted">
                      {fmtDate(c.fb_created_time)} · {c.objective?.replace("OUTCOME_", "") ?? "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(c)}
                    aria-label={c.is_tracked ? "Desativar" : "Ativar"}
                    className={`relative flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                      c.is_tracked ? "bg-positive" : "bg-line"
                    }`}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        c.is_tracked ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "sem data";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
