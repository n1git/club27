import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/shared/app-shell";
import { APP_ROLES } from "@/lib/auth/roles";
import { APP_NAME } from "@/lib/config";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(APP_ROLES);
  if (user.role === "personal") {
    if (await isSocialBanned(user.accountId)) redirect("/settings/account");
    const { data } = await createAdminSupabaseClient().from("accounts").select("username").eq("id", user.accountId).maybeSingle();
    redirect(data ? `/${data.username as string}` : "/settings/account");
  }
  return (
    <AppShell
      personalSwitch
      navGroups={[{ items: [{ href: "/profile", label: "Profil", icon: "profile", exact: true, primary: true }] }]}
      fullName={user.fullName}
      profileHref="/profile"
      roleLabel="Akun"
      clubName={APP_NAME}
    >
      {children}
    </AppShell>
  );
}
