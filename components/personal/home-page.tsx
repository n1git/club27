import Link from "next/link";
import { Suspense } from "react";
import { requireValidSession } from "@/lib/auth/guard";
import { listContexts, listInactiveClubs, listPendingDeletions } from "@/lib/auth/contexts";
import { getWorkoutData } from "@/lib/data/workouts";
import { isSocialBanned } from "@/lib/auth/social-access";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getUpcomingEvents } from "@/lib/data/groups";
import { formatJakartaDate, formatJakartaTime } from "@/lib/format";
import { HomeFeed } from "@/components/personal/home-feed";
import { HomeStories, StoriesBarSkeleton } from "@/components/personal/home-stories";
import { FeedSkeleton } from "@/components/social/post-skeleton";
import { WeekCard, WeekStrip } from "@/components/personal/week-glance";
import { ContextList } from "@/components/shared/context-list";
import { PendingDeletions } from "@/components/shared/pending-deletions";

export async function PersonalHomePage({ searchParams }: { searchParams: Promise<{ sebelum?: string }> }) {
  const { profile } = await requireValidSession();
  const { sebelum } = await searchParams;
  const before = sebelum && !Number.isNaN(Date.parse(sebelum)) ? sebelum : undefined;
  const banned = await isSocialBanned(profile.accountId);
  const [{ entries }, deletions, workouts, upcoming, inactive] = await Promise.all([
    listContexts(profile.accountId),
    listPendingDeletions(profile.accountId),
    getWorkoutData(),
    banned ? Promise.resolve([]) : getUpcomingEvents(),
    listInactiveClubs(profile.accountId),
  ]);
  const week = workouts.weeks[workouts.weeks.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Beranda</h1>
      <PendingDeletions items={deletions} />
      {inactive.length ? (
        <Alert>
          <AlertDescription>
            Akses Anda ke {inactive.join(", ")} sedang dinonaktifkan. Data tetap tersimpan. Hubungi admin klub atau admin platform untuk mengaktifkannya kembali.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className={banned ? "flex flex-col gap-6" : "grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]"}>
        {banned ? null : (
          <div className="-mx-4 flex min-w-0 flex-col sm:mx-0">
            <Suspense fallback={<StoriesBarSkeleton />}>
              <HomeStories accountId={profile.accountId} name={profile.fullName} />
            </Suspense>
            <WeekStrip week={week} goal={workouts.weeklyGoal} />
            <Suspense fallback={<FeedSkeleton />}>
              <HomeFeed accountId={profile.accountId} before={before} />
            </Suspense>
          </div>
        )}
        <aside aria-label="Ringkasan" className={banned ? "flex max-w-md flex-col gap-4" : "flex flex-col gap-4 lg:col-start-2 lg:row-start-1"}>
          {banned ? null : <WeekCard week={week} goal={workouts.weeklyGoal} />}
          <section aria-labelledby="clubs-title" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <h2 id="clubs-title" className="text-sm font-semibold">
              Klub dan organisasi
            </h2>
            {entries.length ? (
              <ContextList options={entries.map((e) => ({ key: e.key, label: e.label, detail: e.detail }))} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Anda belum tergabung di klub mana pun.{" "}
                <Link href="/join" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
                  Gabung klub
                </Link>{" "}
                dengan kode dari admin klub, atau{" "}
                <Link href="/upgrade" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
                  buat klub sendiri
                </Link>
                .
              </p>
            )}
          </section>
          {upcoming.length ? (
            <section aria-labelledby="events-title" className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
              <h2 id="events-title" className="text-sm font-semibold">
                Event mendatang
              </h2>
              <ul className="flex flex-col divide-y divide-border">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link href={`/g/${e.groupId}`} className="flex items-center gap-3 rounded-lg py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary leading-none">
                        <span className="text-base font-semibold tabular-nums">{formatJakartaDate(e.startsAt, { day: "numeric" })}</span>
                        <span className="mt-0.5 text-[10px] text-muted-foreground">{formatJakartaDate(e.startsAt, { month: "short" })}</span>
                      </span>
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-sm font-semibold">{e.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {e.groupName} · {formatJakartaTime(e.startsAt, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
