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
  const [view, setView] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const [start, setStart] = useState<string | null>(value.start);
  const [end, setEnd] = useState<string | null>(value.end);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function pick(dayIso: string) {
    if (!start || (start && end)) {
      setStart(dayIso);
      setEnd(null);
    } else {
      if (dayIso < start) {
        setEnd(start);
        setStart(dayIso);
      } else {
        setEnd(dayIso);
      }
    }
  }

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(new Date(year, month, d)));

  const todayIso = iso(new Date());

  return (
    <div
      ref={ref}
      className="absolute right-0 top-12 z-30 w-[300px] rounded-2xl border border-line bg-elevated p-4 shadow-xl"
    >
      {/* Navegação de mês */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setView(new Date(year, month - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-fg"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span className="text-sm font-bold text-fg">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => setView(new Date(year, month + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-fg"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      {/* Dias da semana */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEK.map((w, i) => (
          <span key={i} className="py-1 text-center text-[11px] font-bold text-muted">
            {w}
          </span>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const isStart = day === start;
          const isEnd = day === end;
          const inRange = start && end && day > start && day < end;
          const selected = isStart || isEnd;
          return (
            <button
              key={i}
              onClick={() => pick(day)}
              className={`relative h-9 rounded-lg text-xs font-bold transition-colors ${
                selected
                  ? "bg-brand text-white"
                  : inRange
                  ? "bg-brand-soft text-brand"
                  : "text-fg hover:bg-surface"
              } ${day === todayIso && !selected ? "ring-1 ring-brand" : ""}`}
            >
              {Number(day.slice(-2))}
            </button>
          );
        })}
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
          className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
