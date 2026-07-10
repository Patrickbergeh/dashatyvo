import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ativa/desativa o rastreio de uma campanha (is_tracked)
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
    .from("ad_campaigns")
    .update({ is_tracked: Boolean(body.is_tracked) })
    .eq("id", params.id)
    .select("id, is_tracked")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ campaign: data });
}
