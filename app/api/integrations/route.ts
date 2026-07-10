import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GRAPH = "https://graph.facebook.com/v20.0";

// Lista as contas conectadas do usuário (sem expor o token)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("facebook_integrations")
    .select("id, ad_account_id, account_name, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ integrations: data ?? [] });
}

// Conecta uma nova conta: valida o token no Graph API e salva
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rawId = String(body.ad_account_id ?? "").trim();
  const token = String(body.access_token ?? "").trim();
  if (!rawId || !token) {
    return NextResponse.json({ error: "Informe o token e o ID da conta." }, { status: 400 });
  }

  const acct = rawId.startsWith("act_") ? rawId : `act_${rawId}`;

  // Valida contra a Graph API
  const res = await fetch(
    `${GRAPH}/${acct}?fields=name,account_status,currency&access_token=${encodeURIComponent(token)}`
  );
  const info = await res.json();
  if (info.error) {
    return NextResponse.json({ error: info.error.message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("facebook_integrations")
    .upsert(
      {
        user_id: user.id,
        ad_account_id: acct,
        account_name: info.name ?? acct,
        access_token: token,
        is_active: true,
      },
      { onConflict: "user_id,ad_account_id" }
    )
    .select("id, ad_account_id, account_name, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ integration: data });
}
