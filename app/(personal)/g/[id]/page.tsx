import { notFound } from "next/navigation";
import { requireValidSession } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getFriendLists } from "@/lib/data/social";
import { getGroupDetail } from "@/lib/data/groups";
import { getReadyClubTypes } from "@/lib/club-type";
import { getGroupBoard, METRIC_KEY, parseBoardParams, PERIOD_KEY } from "@/lib/data/leaderboards";
import { ShareCardButton } from "@/components/shared/share-card-button";
import { Leaderboard } from "@/components/social/leaderboard";
import Link from "next/link";
import { cancelEvent, deleteGroup, leaveGroup, removeGroupMember, respondGroupInvite, rsvpEvent } from "@/lib/actions/groups";
import { formatJakartaDate, formatJakartaDateTime, formatJakartaTime } from "@/lib/format";
import { ActionButton } from "@/components/shared/action-button";
import { EventForm, InviteForm } from "@/components/groups/group-forms";
import { ReportDialog } from "@/components/social/report-dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/social/avatar";
import { EmptyPanel, GROUP, PageTop, Section } from "@/components/personal/page-top";
import { FormSheet } from "@/components/ui/form-sheet";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; metrik?: string; periode?: string; olahraga?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { profile } = await requireValidSession();
  if (await isSocialBanned(profile.accountId)) notFound();
  const lists = await getFriendLists(profile.accountId);
  const detail = await getGroupDetail(profile.accountId, id, lists.friends.map((f) => f.person));
  if (!detail) notFound();
  const { group, members, events, invitable } = detail;

  if (group.status === "invited") {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageTop title={group.name} subtitle={`Undangan dari ${group.owner?.fullName ?? "pengguna"}`} />
        {group.description ? <p className="text-sm">{group.description}</p> : null}
        <div className="flex gap-2">
          <ActionButton action={respondGroupInvite} fields={{ groupId: group.id, accept: "1" }} label="Terima undangan" variant="default" />
          <ActionButton action={respondGroupInvite} fields={{ groupId: group.id, accept: "0" }} label="Tolak" />
        </div>
      </div>
    );
  }

  if (query.tab === "peringkat") {
    const board = parseBoardParams(query);
    const [rows, clubTypes] = await Promise.all([getGroupBoard(group.id, board), getReadyClubTypes()]);
    const sports = clubTypes.map((t) => ({ code: t.code, label: t.name.replace(/^Klub\s+/, "") }));
    const hrefFor = (patch: { metrik?: string; periode?: string; olahraga?: string | null }) => {
      const next = new URLSearchParams({ tab: "peringkat" });
      const metrik = patch.metrik ?? query.metrik;
      const periode = patch.periode ?? query.periode;
      const olahraga = patch.olahraga === undefined ? query.olahraga : patch.olahraga;
      if (metrik) next.set("metrik", metrik);
      if (periode) next.set("periode", periode);
      if (olahraga) next.set("olahraga", olahraga);
      return `/g/${group.id}?${next.toString()}`;
    };
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageTop title={group.name} subtitle="Peringkat anggota grup" />
        <GroupTabs groupId={group.id} active="peringkat" />
        <Leaderboard rows={rows} params={board} sports={sports} hrefFor={hrefFor} />
        {rows.some((r) => r.isMe && r.rank !== null) ? (
          <div>
            <ShareCardButton
              href={`/api/cards/rank/${group.id}?metrik=${METRIC_KEY[board.metric]}&periode=${PERIOD_KEY[board.period]}`}
              filename={`peringkat-${board.metric}-${board.period}`}
              label="Kartu peringkat saya"
            />
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">Hanya total per anggota yang tampil, bukan catatan latihannya. Anggota yang memblokir atau diblokir olehmu tidak ikut tampil.</p>
      </div>
    );
  }

  const upcoming = events.filter((e) => !e.cancelled && !e.finished);
  const past = events.filter((e) => e.cancelled || e.finished).slice(-5);
  const activeMembers = members.filter((m) => m.status === "active").length;
  return (
    <div className="flex flex-col gap-6">
      <PageTop title={group.name} subtitle={group.description ?? undefined}>
        {group.isOwner ? (
          <FormSheet label="Buat event" title="Buat event" size="sm">
            <EventForm groupId={group.id} />
          </FormSheet>
        ) : null}
      </PageTop>
      <GroupTabs groupId={group.id} active="ringkasan" />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Section title="Event mendatang" count={upcoming.length}>
          {upcoming.length === 0 ? (
            <EmptyPanel>
              <p>Belum ada event. {group.isOwner ? "Buat event untuk mengajak anggota berlatih bersama." : "Pemilik grup bisa membuat event."}</p>
              {group.isOwner ? (
                <FormSheet label="Buat event pertama" title="Buat event" size="sm">
                  <EventForm groupId={group.id} />
                </FormSheet>
              ) : null}
            </EmptyPanel>
          ) : (
            <ul className="flex flex-col gap-3">
              {upcoming.map((e) => (
                <li key={e.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary leading-none">
                      <span className="text-lg font-semibold tabular-nums">{formatJakartaDate(e.startsAt, { day: "numeric" })}</span>
                      <span className="mt-0.5 text-[10px] text-muted-foreground">{formatJakartaDate(e.startsAt, { month: "short" })}</span>
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-sm font-semibold">{e.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatJakartaTime(e.startsAt, { hour: "2-digit", minute: "2-digit" })}
                        {e.location ? ` · ${e.location}` : ""}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {e.going} ikut{e.capacity ? ` dari ${e.capacity}` : ""} · {e.maybe} mungkin
                      </span>
                    </div>
                  </div>
                  {e.description ? <p className="whitespace-pre-wrap break-words text-sm">{e.description}</p> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    {(["going", "maybe", "declined"] as const).map((status) => (
                      <ActionButton
                        key={status}
                        action={rsvpEvent}
                        fields={{ eventId: e.id, status }}
                        label={{ going: "Ikut", maybe: "Mungkin", declined: "Tidak" }[status]}
                        variant={e.mine === status ? "default" : "outline"}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 border-t border-border pt-2 text-xs">
                    {e.createdBy === profile.accountId || group.isOwner ? (
                      <ActionButton action={cancelEvent} fields={{ eventId: e.id }} label="Batalkan event" variant="ghost" confirmMessage="Batalkan event ini?" />
                    ) : null}
                    <ReportDialog targetType="event" targetId={e.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {past.length ? (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {past.map((e) => (
                <li key={e.id}>
                  {e.title} · {formatJakartaDateTime(e.startsAt)}
                  {e.cancelled ? " · dibatalkan" : " · selesai"}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section title="Anggota" count={activeMembers}>
          <ul className={GROUP}>
            {members.map((m) => (
              <li key={m.accountId} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.person?.fullName ?? "Pengguna"} src={m.person?.avatarUrl} size={40} />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  {m.person ? (
                    <Link href={`/${m.person.username}`} className="truncate text-sm font-semibold hover:underline">
                      {m.person.fullName}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-semibold">Pengguna</span>
                  )}
                  {m.person ? <span className="truncate text-xs text-muted-foreground">@{m.person.username}</span> : null}
                </span>
                {m.role === "owner" ? <Badge variant="secondary">Pemilik</Badge> : null}
                {m.status === "invited" ? <Badge variant="secondary">Diundang</Badge> : null}
                {group.isOwner && m.role !== "owner" ? (
                  <ActionButton
                    action={removeGroupMember}
                    fields={{ groupId: group.id, accountId: m.accountId }}
                    label="Keluarkan"
                    variant="ghost"
                    confirmMessage="Keluarkan anggota ini?"
                  />
                ) : null}
              </li>
            ))}
          </ul>
          {group.isOwner ? (
            <FormSheet label="Undang teman" title="Undang teman" variant="outline" size="sm" className="w-fit">
              <InviteForm groupId={group.id} friends={invitable} />
            </FormSheet>
          ) : null}
        </Section>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {group.isOwner ? (
          <ActionButton
            action={deleteGroup}
            fields={{ groupId: group.id }}
            label="Hapus grup"
            variant="destructive"
            confirmMessage="Hapus grup beserta semua event? Tindakan ini tidak bisa dibatalkan."
          />
        ) : (
          <>
            <ActionButton action={leaveGroup} fields={{ groupId: group.id }} label="Keluar dari grup" confirmMessage="Keluar dari grup ini?" />
            <ReportDialog targetType="group" targetId={group.id} />
          </>
        )}
      </div>
    </div>
  );
}

function GroupTabs({ groupId, active }: { groupId: string; active: "ringkasan" | "peringkat" }) {
  const tab = (key: "ringkasan" | "peringkat", label: string, href: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`rounded-lg px-4 py-1.5 text-sm font-semibold ui-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Bagian grup" className="inline-flex w-fit gap-1 rounded-xl bg-secondary p-1">
      {tab("ringkasan", "Ringkasan", `/g/${groupId}`)}
      {tab("peringkat", "Peringkat", `/g/${groupId}?tab=peringkat`)}
    </nav>
  );
}
