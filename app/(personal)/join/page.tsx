import type { Metadata } from "next";
import { requireValidSession } from "@/lib/auth/guard";
import { getMyJoinRequests } from "@/lib/data/club-join";
import { getMyBoardClubs } from "@/lib/data/leaderboards";
import { LeaderboardOptin } from "@/components/social/leaderboard-optin";
import { cancelClubJoin } from "@/lib/actions/club-join";
import { formatJakartaDate, getJakartaDateString } from "@/lib/format";
import { ActionButton } from "@/components/shared/action-button";
import { JoinForm } from "@/components/club-join/join-form";
import { GROUP, PageTop, Section } from "@/components/personal/page-top";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Gabung klub" };

const STATUS = {
  pending: { label: "Menunggu", variant: "secondary" },
  approved: { label: "Disetujui", variant: "success" },
  rejected: { label: "Ditolak", variant: "secondary" },
  cancelled: { label: "Dibatalkan", variant: "secondary" },
} as const;

export default async function JoinClubPage() {
  const { profile } = await requireValidSession();
  const [requests, boardClubs] = await Promise.all([getMyJoinRequests(profile.accountId), getMyBoardClubs()]);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageTop
        title="Gabung klub"
        subtitle="Minta kode klub ke admin klub, lalu kirim permintaan. Anak-anak didaftarkan oleh klub."
        mobileSubtitle="Minta kode klub ke admin klub."
      />
      <section aria-label="Kirim permintaan" className="rounded-2xl border border-border bg-card p-4">
        <JoinForm fullName={profile.fullName} today={getJakartaDateString()} />
      </section>
      {requests.length ? (
        <Section title="Permintaan Anda" count={requests.length}>
          <ul className={GROUP}>
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold">{r.clubName}</span>
                  <span className="text-xs text-muted-foreground">{formatJakartaDate(r.createdAt)}</span>
                </span>
                <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
                {r.status === "pending" ? <ActionButton action={cancelClubJoin} fields={{ requestId: r.id }} label="Batalkan" /> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {boardClubs.length > 0 ? (
        <Section title="Peringkat klub">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Secara bawaan total latihan Anda tidak tampil di klub. Aktifkan jika Anda ingin ikut peringkat klub; anggota dan admin klub akan melihat nama dan totalnya. Bisa dimatikan kapan saja.
            </p>
            {boardClubs.map((club) => (
              <LeaderboardOptin key={club.clubId} club={club} />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
