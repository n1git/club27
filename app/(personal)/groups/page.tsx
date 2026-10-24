import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireValidSession } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getMyGroups } from "@/lib/data/groups";
import { respondGroupInvite } from "@/lib/actions/groups";
import { ActionButton } from "@/components/shared/action-button";
import { GroupCreateForm } from "@/components/groups/group-forms";
import { EmptyPanel, GROUP, PageTop, Section } from "@/components/personal/page-top";
import { FormSheet } from "@/components/ui/form-sheet";

export const metadata: Metadata = { title: "Grup" };

function Tile({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-base font-semibold">
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

export default async function GroupsPage() {
  const { profile } = await requireValidSession();
  if (await isSocialBanned(profile.accountId)) notFound();
  const groups = await getMyGroups(profile.accountId);
  const invites = groups.filter((g) => g.status === "invited");
  const active = groups.filter((g) => g.status === "active");
  const create = (
    <FormSheet label="Buat grup" title="Buat grup" size="sm">
      <GroupCreateForm />
    </FormSheet>
  );
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageTop title="Grup" subtitle="Grup bersifat privat: hanya teman yang bisa diundang, dan hanya anggota yang melihat anggota dan event." mobileSubtitle="Privat, hanya untuk anggota.">
        {create}
      </PageTop>
      {invites.length ? (
        <Section title="Undangan" count={invites.length}>
          <ul className={GROUP}>
            {invites.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/g/${g.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Tile name={g.name} />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-semibold">{g.name}</span>
                    <span className="truncate text-xs text-muted-foreground">Dari {g.owner?.fullName ?? "pengguna"}</span>
                  </span>
                </Link>
                <ActionButton action={respondGroupInvite} fields={{ groupId: g.id, accept: "1" }} label="Terima" variant="default" />
                <ActionButton action={respondGroupInvite} fields={{ groupId: g.id, accept: "0" }} label="Tolak" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section title="Grup Anda" count={active.length}>
        {active.length === 0 ? (
          <EmptyPanel>
            <p>Belum ada grup. Buat grup untuk mengundang teman, membuat event, dan saling melihat peringkat.</p>
            <FormSheet label="Buat grup pertama" title="Buat grup" size="sm">
              <GroupCreateForm />
            </FormSheet>
          </EmptyPanel>
        ) : (
          <ul className={GROUP}>
            {active.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/g/${g.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Tile name={g.name} />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-sm font-semibold">{g.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {g.isOwner ? "Anda pemilik" : `Dibuat oleh ${g.owner?.fullName ?? "pengguna"}`}
                      {g.description ? ` · ${g.description}` : ""}
                    </span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
