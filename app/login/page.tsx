"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(traduz(error.message));
    else {
      await logActivity("Fez login");
      // e-mail de login (best-effort, não bloqueia)
      fetch("/api/email/login", { method: "POST" }).catch(() => {});
      router.push("/dashboard");
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px]">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
        >
          <label className="mb-1.5 block text-sm font-bold text-fg">E-mail</label>
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-bg px-3.5">
            <MailIcon />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
              className="w-full border-0 bg-transparent py-3 text-sm text-fg placeholder:text-muted"
            />
          </div>

          <label className="mb-1.5 block text-sm font-bold text-fg">Senha</label>
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-line bg-bg px-3.5">
            <LockIcon />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border-0 bg-transparent py-3 text-sm text-fg placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="text-muted transition-colors hover:text-fg"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-brand w-full rounded-xl py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Carregando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function traduz(msg: string) {
  if (msg.includes("Invalid login")) return "E-mail ou senha inválidos.";
  if (msg.includes("already registered")) return "Este e-mail já está cadastrado.";
  if (msg.includes("Password should be")) return "A senha deve ter no mínimo 6 caracteres.";
  return msg;
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--muted))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--muted))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.2A9.6 9.6 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2 2.9M6.6 6.6C3.6 8.3 2 11 2 11s3.5 7 10 7a9.6 9.6 0 0 0 3.5-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
    </svg>
  );
}
