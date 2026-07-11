import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailLogin } from "@/lib/email";

// Dispara o e-mail de "login realizado" para o usuário autenticado.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  const r = await emailLogin(user.email);
  return NextResponse.json({ ok: r.ok });
}
