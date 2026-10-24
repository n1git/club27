import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireValidSession } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getFriendLists } from "@/lib/data/social";
import { FriendsView } from "@/components/personal/friends-view";
import { QuickAddTrigger } from "@/components/personal/quick-add";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Teman" };

export default async function FriendsPage() {
  const { profile } = await requireValidSession();
  if (await isSocialBanned(profile.accountId)) notFound();
  const lists = await getFriendLists(profile.accountId);
  return (
    <div className="flex flex-col gap-6">
      <div className="hidden sm:block">
        <PageHeader title="Teman" subtitle="Postingan Anda hanya terlihat oleh teman. Tambah teman dengan username yang persis sama.">
          <QuickAddTrigger kind="friend" size="sm">
            Tambah teman
          </QuickAddTrigger>
        </PageHeader>
      </div>
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div>
          <h1 className="text-xl font-semibold leading-tight">Teman</h1>
          <p className="text-xs text-muted-foreground">Postingan Anda hanya terlihat oleh teman.</p>
        </div>
        <QuickAddTrigger kind="friend" size="sm">
          Tambah teman
        </QuickAddTrigger>
      </div>
      <FriendsView lists={lists} />
    </div>
  );
}
