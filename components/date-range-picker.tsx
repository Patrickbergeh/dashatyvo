"use client";

import { useEffect, useRef, useState } from "react";

export type Range = { start: string | null; end: string | null };

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function MonthGrid({
  month,
  start,
  end,
  onPick,
}: {
  month: Date;
  start: string | null;
  end: string | null;
  onPick: (d: string) => void;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const todayIso = iso(new Date());

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(new Date(year, m, d)));

  return (
    <div className="w-[240px]">
      <p className="mb-2 text-center text-sm font-bold text-fg">
        {MONTHS[m]} {year}
      </p>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEK.map((w, i) => (
          <span key={i} className="py-1 text-center text-[11px] font-bold text-muted">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const isEdge = day === start || day === end;
          const inRange = start && end && day > start && day < end;
          return (
            <button
              key={i}
              onClick={() => onPick(day)}
              className={`relative h-9 rounded-lg text-xs font-bold transition-colors ${
                isEdge
                  ? "bg-brand text-black"
                  : inRange
                  ? "bg-brand/30 text-fg"
                  : "text-fg hover:bg-surface"
              } ${day === todayIso && !isEdge ? "ring-1 ring-brand" : ""}`}
            >
              {Number(day.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({
  value,
  onApply,
  onClose,
}: {
  value: Range;
  onApply: (r: Range) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const base = value.start ? new Date(value.start + "T00:00:00") : new Date();
  // "view" é o mês da ESQUERDA; a direita é view + 1 mês
  const [view, setView] = useState(
    new Date(base.getFullYear(), base.getMonth() - 1, 1)
  );
  const [start, setStart] = useState<string | null>(value.start);
  const [end, setEnd] = useState<string | null>(value.end);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  function pick(dayIso: string) {
    if (!start || (start && end)) {
      setStart(dayIso);
      setEnd(null);
    } else if (dayIso < start) {
      setEnd(start);
      setStart(dayIso);
    } else {
      setEnd(dayIso);
    }
  }

  const rightMonth = new Date(view.getFullYear(), view.getMonth() + 1, 1);
  const fmt = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");

  return (
    <div
      ref={ref}
      className="absolute right-0 top-12 z-30 rounded-2xl border border-line bg-elevated p-4 shadow-xl"
    >
      {/* Navegação */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() =>
            setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-fg"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span className="text-xs font-bold text-muted">
          {fmt(start)} — {fmt(end)}
        </span>
        <button
          onClick={() =>
            setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-fg"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      {/* Dois calendários: início (esq) e fim (dir) */}
      <div className="flex gap-5">
        <MonthGrid month={view} start={start} end={end} onPick={pick} />
        <div className="w-px bg-line" />
        <MonthGrid month={rightMonth} start={start} end={end} onPick={pick} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-line py-2.5 text-sm font-bold text-muted transition-colors hover:text-fg"
        >
          Cancelar
        </button>
        <button
          onClick={() => onApply({ start, end: end ?? start })}
          disabled={!start}
          className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
