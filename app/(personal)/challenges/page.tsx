import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getReadyClubTypes } from "@/lib/club-type";
import { createGroupChallenge } from "@/lib/actions/challenges";
import { getChallengeProgress, getMyChallengeState, listVisibleChallenges } from "@/lib/data/challenges";
import { getJakartaDateString } from "@/lib/format";
import { ChallengeCard } from "@/components/challenges/challenge-card";
import { ChallengeForm } from "@/components/challenges/challenge-form";
import { EmptyPanel, PageTop, Section } from "@/components/personal/page-top";
import { FormSheet } from "@/components/ui/form-sheet";

export const unstable_dynamicStaleTime = 0;

export default async function ChallengesPage() {
  const user = await requireRole("personal");
  if (await isSocialBanned(user.accountId)) notFound();
  const [challenges, state, clubTypes] = await Promise.all([listVisibleChallenges(), getMyChallengeState(user.accountId), getReadyClubTypes()]);
  const progress = await Promise.all(challenges.map((c) => getChallengeProgress(c.id)));
  const sports = clubTypes.map((t) => ({ code: t.code, label: t.name.replace(/^Klub\s+/, "") }));
  const labels = new Map(sports.map((s) => [s.code, s.label]));
  const today = getJakartaDateString();
  const active = challenges.map((c, i) => ({ c, p: progress[i] })).filter(({ c }) => c.endsOn >= today);
  const past = challenges.map((c, i) => ({ c, p: progress[i] })).filter(({ c }) => c.endsOn < today);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageTop title="Tantangan" subtitle="Tantangan dari grup dan klub Anda. Ikut sukarela, progres dihitung dari catatan latihan." mobileSubtitle="Progres dihitung dari catatan latihan.">
        {state.ownedGroups.length ? (
          <FormSheet label="Buat tantangan" title="Buat tantangan grup" size="sm">
            <ChallengeForm action={createGroupChallenge} groups={state.ownedGroups} sports={sports} today={today} />
          </FormSheet>
        ) : null}
      </PageTop>
      <Section title="Berjalan" count={active.length}>
        {active.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {active.map(({ c, p }) => (
              <ChallengeCard key={c.id} challenge={c} progress={p} joined={state.joined.has(c.id)} today={today} sportLabel={c.sport ? labels.get(c.sport) : undefined} href={`/c/${c.id}`} />
            ))}
          </ul>
        ) : (
          <EmptyPanel>
            <p>Belum ada tantangan berjalan di grup atau klub Anda.{state.ownedGroups.length ? "" : " Pemilik grup bisa membuat tantangan untuk anggotanya."}</p>
          </EmptyPanel>
        )}
      </Section>
      {past.length ? (
        <Section title="Sudah selesai" count={past.length}>
          <ul className="grid gap-3 md:grid-cols-2">
            {past.map(({ c, p }) => (
              <ChallengeCard key={c.id} challenge={c} progress={p} joined={state.joined.has(c.id)} today={today} sportLabel={c.sport ? labels.get(c.sport) : undefined} href={`/c/${c.id}`} />
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
