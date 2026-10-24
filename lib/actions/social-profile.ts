"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { socialBlocked } from "@/lib/auth/social-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionState } from "./types";

const schema = z.object({
  bio: z.string().trim().max(160, "Bio maksimal 160 karakter"),
  badges: z.array(z.string().uuid()).max(3, "Pilih maksimal 3 lencana"),
});

export async function updateSocialProfile(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const blocked = await socialBlocked(session.account_id);
  if (blocked) return blocked;
  const parsed = schema.safeParse({ bio: formData.get("bio") ?? "", badges: formData.getAll("badge").map(String) });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const ids = [...new Set(parsed.data.badges)];
  if (ids.length) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("achievements").select("id").in("id", ids);
    if ((data ?? []).length !== ids.length) return { ok: false, error: "Lencana tidak ditemukan" };
  }
  const { error } = await createAdminSupabaseClient()
    .from("accounts")
    .update({ bio: parsed.data.bio || null, featured_badges: ids })
    .eq("id", session.account_id);
  if (error) return { ok: false, error: "Gagal menyimpan profil" };
  revalidatePath("/", "layout");
  return { ok: true, message: "Profil sosial disimpan" };
}
