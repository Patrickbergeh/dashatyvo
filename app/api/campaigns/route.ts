import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lista as campanhas do usuário (vindas do banco)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("ad_campaigns")
    .select(
      "id, ad_account_id, campaign_id, campaign_name, status, objective, is_tracked, fb_created_time"
    )
    .order("fb_created_time", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ campaigns: data ?? [] });
}
