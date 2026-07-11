"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Controle segmentado com destaque que DESLIZA suavemente pro selecionado.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  chevron,
  extra,
}: {
  options: readonly (readonly [T, string])[];
  value: T | null;
  onChange: (k: T) => void;
  chevron?: boolean;
  extra?: ReactNode;
}) {
  const contRef = useRef<HTMLDivElement>(null);
  const btns = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0, show: false });
  const [ready, setReady] = useState(false);

  const measure = () => {
    const cont = contRef.current;
    const btn = value ? btns.current[value] : null;
    if (cont && btn) {
      const cr = cont.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      setPill({ left: br.left - cr.left, width: br.width, show: true });
    } else {
      setPill((p) => ({ ...p, show: false }));
    }
  };

  useLayoutEffect(measure, [value, options]);

  useEffect(() => {
    // habilita a transição só após a 1ª posição (evita deslizar do 0 ao carregar)
    const r = requestAnimationFrame(() => setReady(true));
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(r);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={contRef}
      className="relative flex items-center gap-1 rounded-full border border-line bg-surface p-1 text-sm"
    >
      <span
        className={`pointer-events-none absolute bottom-1 top-1 rounded-full bg-brand ${
          ready ? "transition-all duration-300 ease-out" : ""
        } ${pill.show ? "opacity-100" : "opacity-0"}`}
        style={{ left: pill.left, width: pill.width }}
      />
      {options.map(([key, label], i) => (
        <Fragment key={key}>
          {chevron && i > 0 && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgb(var(--muted))"
              strokeWidth="2"
              strokeLinecap="round"
              className="mx-0.5 shrink-0"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          )}
          <button
            ref={(el) => {
              btns.current[key] = el;
            }}
            onClick={() => onChange(key)}
            className={`relative z-10 whitespace-nowrap rounded-full px-4 py-1.5 font-bold transition-colors ${
              value === key ? "text-black" : "text-muted hover:text-fg"
            }`}
          >
            {label}
          </button>
        </Fragment>
      ))}
      {extra}
    </div>
  );
}
