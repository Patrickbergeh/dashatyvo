import { createClient } from "@/lib/supabase/client";

// Registra uma atividade do usuário logado no histórico da plataforma.
export async function logActivity(action: string) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    await supabase.from("activity_log").insert({
      user_id: user.id,
      email: user.email,
      action,
    });
  } catch {
    /* log é best-effort; nunca quebra a UI */
  }
}
