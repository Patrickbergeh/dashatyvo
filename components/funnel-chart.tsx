"use client";

export type FunnelSegment = { label: string; value: string };

// Funil afunilando (topo largo -> base estreita), verde -> cinza bem claro.
export function FunnelChart({ segments }: { segments: FunnelSegment[] }) {
  const n = segments.length;
  const W_TOP = 100;
  const W_BOTTOM = 44;
  const widthAt = (i: number) => W_TOP - (W_TOP - W_BOTTOM) * (i / n);

  // cor: verde (#e0ff92) no topo -> cinza claro (#e9edf2) na base
  const color = (i: number) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const r = Math.round(224 + (233 - 224) * t);
    const g = Math.round(255 + (237 - 255) * t);
    const b = Math.round(146 + (242 - 146) * t);
    return `rgb(${r} ${g} ${b})`;
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col rounded-2xl border border-line bg-surface p-4 xl:h-full">
      <div className="flex flex-1 flex-col gap-1">
        {segments.map((s, i) => {
          const wt = widthAt(i);
          const wb = widthAt(i + 1);
          const clip = `polygon(${(100 - wt) / 2}% 0, ${(100 + wt) / 2}% 0, ${
            (100 + wb) / 2
          }% 100%, ${(100 - wb) / 2}% 100%)`;
          return (
            <div key={i} className="relative min-h-0 flex-1">
              <div
                className="absolute inset-0"
                style={{ clipPath: clip, background: color(i) }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center leading-tight text-black">
                <span className="text-[11px] font-bold opacity-80">{s.label}</span>
                <span className="text-base font-bold">{s.value}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
