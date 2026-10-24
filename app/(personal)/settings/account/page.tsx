import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getProfileData } from "@/lib/data/profile";
import { getOwnAvatarUrl, getSocialProfileSettings } from "@/lib/data/social";
import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = { title: "Akun" };

export default async function AccountSettingsPage() {
  const user = await requireRole("personal");
  const [data, restricted] = await Promise.all([getProfileData(user.accountId), isSocialBanned(user.accountId)]);
  if (!data) notFound();
  const [url, settings] = restricted ? [null, null] : await Promise.all([getOwnAvatarUrl(user.accountId), getSocialProfileSettings(user.accountId)]);
  return <ProfileView data={data} avatar={restricted ? null : { url }} view="account" socialSettings={settings} />;
}
