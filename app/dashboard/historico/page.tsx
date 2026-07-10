import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HistoryClient } from "@/components/history-client";

export default async function HistoricoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <HistoryClient />;
}
