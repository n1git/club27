import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getJakartaDateString } from "@/lib/format";

const seen = new Map<string, string>();

export function noteActivity(accountId: string) {
  const day = getJakartaDateString();
  if (seen.get(accountId) === day) return;
  seen.set(accountId, day);
  if (seen.size > 10000) seen.clear();
  void createAdminSupabaseClient()
    .rpc("record_activity_day", { p_account: accountId })
    .then(({ error }) => {
      if (error) seen.delete(accountId);
    });
}
