"use client";

import { useMemo, useState } from "react";
import { CreativeThumb } from "@/components/creative-thumb";

export type FunnelEntity = {
  entity_id: string;
  name: string;
  status: string;
  parent_id: string;
  thumbnail_url: string | null;
  image_url: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  lpv: number;
  initiate_checkout: number;
  sales: number;
  revenue: number;
  is_tracked: boolean;
};

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FunnelPanel({
  level,
  entities,
  loading,
  onToggle,
}: {
  level: "adset" | "ad";
  entities: FunnelEntity[];
  loading: boolean;
  onToggle: (e: FunnelEntity) => void;
}) {
  const [query, setQuery] = useState("");
  const title = level === "adset" ? "Conjuntos" : "Anúncios";
  const sub =
    level === "adset"
      ? "Dos conjuntos das campanhas ativas"
      : "Dos anúncios dos conjuntos ativos";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter((e) => (e.name ?? "").toLowerCase().includes(q));
  }, [entities, query]);

  const trackedCount = entities.filter((e) => e.is_tracked).length;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-4 py-3.5">
        <h3 className="text-sm font-bold text-fg">{title}</h3>
        <p className="text-xs text-muted">
          {trackedCount} de {entities.length} ativos · {sub}
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-bg px-3">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--muted))" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${level === "adset" ? "conjunto" : "anúncio"}...`}
            className="w-full border-0 bg-transparent py-2 text-sm text-fg placeholder:text-muted"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-line bg-bg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted">
            Nada aqui. Ative campanhas/conjuntos no nível anterior.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => {
              const isActive = e.status === "ACTIVE";
              return (
                <div
                  key={e.entity_id}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-line bg-bg p-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {level === "ad" && (
                      <CreativeThumb
                        url={e.thumbnail_url}
                        full={e.image_url}
                        size={40}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            isActive ? "bg-positive" : "bg-muted"
                          }`}
                        />
                        <p className="truncate text-xs font-bold text-fg">{e.name}</p>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {brl(e.spend)} · {e.link_clicks} cliques · {e.lpv} views
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggle(e)}
                    aria-label={e.is_tracked ? "Desativar" : "Ativar"}
                    className={`relative flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                      e.is_tracked ? "bg-positive" : "bg-line"
                    }`}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        e.is_tracked ? "translate-x-5" : "translate-x-0"
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
