import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ativa/desativa uma conta (toggle is_active)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { data, error } = await supabase
    .from("facebook_integrations")
    .update({ is_active: Boolean(body.is_active) })
    .eq("id", params.id)
    .select("id, ad_account_id, account_name, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ integration: data });
}

// Remove uma conta conectada
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("facebook_integrations")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
