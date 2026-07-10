"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Miniatura do criativo com preview grande (imagem original) ao passar o mouse
export function CreativeThumb({
  url,
  full,
  size = 40,
}: {
  url: string | null;
  full?: string | null;
  size?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => setMounted(true), []);

  // imagem original (alta qualidade) no preview; cai pro thumbnail se não houver
  const preview = full || url;

  const show = (e: React.MouseEvent) => {
    if (preview) setPos({ x: e.clientX, y: e.clientY });
  };
  const hide = () => setPos(null);

  // posição do preview (à esquerda do cursor, pois o painel fica à direita)
  const left = pos ? Math.max(12, pos.x - 460) : 0;
  const top = pos ? Math.max(12, Math.min(pos.y - 160, 99999)) : 0;

  return (
    <>
      <span
        onMouseEnter={show}
        onMouseMove={show}
        onMouseLeave={hide}
        style={{ width: size, height: size }}
        className="block shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-line bg-elevated"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </span>

      {mounted &&
        pos &&
        preview &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999]"
            style={{ left, top }}
          >
            <div className="overflow-hidden rounded-2xl border-2 border-white/80 bg-black shadow-2xl">
              {/* imagem original em alta qualidade, no tamanho natural (limitada à tela) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt=""
                className="block max-h-[80vh] max-w-[440px] object-contain"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
