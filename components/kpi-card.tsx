import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  trend,
  icon,
  accent,
  tone,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: number | null;
  icon: ReactNode;
  accent?: boolean;
  tone?: "positive" | "negative" | null;
  badge?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-5 transition-colors ${
        accent
          ? "bg-brand text-black"
          : "border border-line bg-surface"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            accent ? "bg-black/10 text-black" : "bg-brand text-black"
          }`}
        >
          {icon}
        </span>
        {typeof trend === "number" && (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              accent
                ? "bg-black/10 text-black"
                : trend >= 0
                ? "bg-positive/10 text-positive"
                : "bg-negative/10 text-negative"
            }`}
          >
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              tone === "negative"
                ? "bg-negative/10 text-negative"
                : "bg-positive/10 text-positive"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <p
        className={`mt-4 text-sm font-bold ${
          accent ? "text-black/70" : "text-muted"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-[26px] font-bold leading-none tracking-tight ${
          accent
            ? ""
            : tone === "negative"
            ? "text-negative"
            : tone === "positive"
            ? "text-positive"
            : ""
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className={`mt-2 text-xs ${accent ? "text-black/60" : "text-muted"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
