"use client";

import { AnimatedNumber } from "@/components/animated-number";

export type FunnelSegment = {
  label: string;
  value: number;
  format: (n: number) => string;
};

// Funil de gomos arredondados, ligados por um tubo central que desce
// e encosta no gomo de baixo. Verde (#e0ff92) -> cinza bem claro.
export function FunnelChart({ segments }: { segments: FunnelSegment[] }) {
  const n = segments.length;
  const W_TOP = 100;
  const W_BOTTOM = 42;
  const widthAt = (i: number) =>
    n > 1 ? W_TOP - (W_TOP - W_BOTTOM) * (i / (n - 1)) : W_TOP;

  const color = (i: number) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const r = Math.round(224 + (233 - 224) * t);
    const g = Math.round(255 + (237 - 255) * t);
    const b = Math.round(146 + (242 - 146) * t);
    return `rgb(${r} ${g} ${b})`;
  };

  // largura do tubo: mais largo no topo, afinando pouco a pouco até a base
  const tubeW = (i: number) => {
    const TOP = 170;
    const BOTTOM = 96;
    const t = n > 2 ? i / (n - 2) : 0; // i vai de 0 a n-2 (conectores)
    return Math.round(TOP - (TOP - BOTTOM) * t);
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col rounded-2xl border border-line bg-surface p-4 xl:h-full">
      {segments.map((s, i) => (
        <div key={i} className="flex min-h-0 flex-1 flex-col">
          {/* gomo arredondado */}
          <div
            className="relative mx-auto flex flex-1 items-center justify-center rounded-2xl"
            style={{ width: `${widthAt(i)}%`, background: color(i) }}
          >
            <div className="px-3 text-center leading-tight text-black">
              <div className="text-[11px] font-bold opacity-80">{s.label}</div>
              <div className="text-base font-bold">
                <AnimatedNumber value={s.value} format={s.format} />
              </div>
            </div>
          </div>

          {/* tubo central descendo até o próximo gomo */}
          {i < n - 1 && (
            <div
              className="mx-auto h-4 shrink-0 rounded-b-md"
              style={{ background: color(i), width: `${tubeW(i)}px` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
