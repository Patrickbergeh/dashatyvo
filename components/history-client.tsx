"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";

type Activity = {
  id: string;
  email: string | null;
  action: string;
  created_at: string;
};

export function HistoryClient() {
  const supabase = createClient();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, email, action, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      setItems((data as Activity[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
        <div className="flex w-full items-center justify-between px-6 py-3.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-bold text-muted transition-colors hover:text-fg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Voltar ao dashboard
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="w-full px-6 py-7">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="max-h-[calc(100vh-8rem)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="text-left text-xs font-bold text-muted">
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Atividade</th>
                  <th className="px-5 py-3 whitespace-nowrap">Data / hora</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-muted">
                      Carregando...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-muted">
                      Nenhuma atividade registrada ainda.
                    </td>
                  </tr>
                ) : (
                  items.map((a) => (
                    <tr key={a.id} className="border-t border-line">
                      <td className="px-5 py-3 font-bold text-fg">{a.email ?? "—"}</td>
                      <td className="px-5 py-3 text-fg">{a.action}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted">
                        {fmt(a.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
