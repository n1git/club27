import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { WeekSummary } from "@/lib/data/workouts";
import { ProgressRing } from "@/components/workouts/progress-ring";
import { QuickAddTrigger } from "./quick-add";

function distance(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km` : `${m} m`;
}

export function WeekStrip({ week, goal }: { week: WeekSummary; goal: number | null }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
      <Link href="/workouts" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ProgressRing sessions={week.sessions} goal={goal} className="size-12">
          <span className="text-sm font-semibold tabular-nums leading-none">{week.sessions}</span>
        </ProgressRing>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-sm font-semibold">{goal ? `${week.sessions} dari ${goal} sesi minggu ini` : `${week.sessions} sesi minggu ini`}</span>
          <span className="truncate text-xs text-muted-foreground">
            {week.minutes.toLocaleString("id-ID")} menit
            {week.distanceM ? ` · ${distance(week.distanceM)}` : ""}
          </span>
        </span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </Link>
      <QuickAddTrigger kind="workout" size="sm">
        Catat
      </QuickAddTrigger>
    </div>
  );
}

export function WeekCard({ week, goal }: { week: WeekSummary; goal: number | null }) {
  return (
    <section aria-labelledby="glance-title" className="hidden flex-col gap-4 rounded-2xl border border-border bg-card p-4 lg:flex">
      <div className="flex items-center justify-between gap-3">
        <h2 id="glance-title" className="text-sm font-semibold">
          Latihan minggu ini
        </h2>
        <Link href="/workouts" className="text-xs font-medium text-accent-foreground underline-offset-4 hover:underline">
          Lihat semua
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <ProgressRing sessions={week.sessions} goal={goal} className="size-20">
          <span className="text-xl font-semibold tabular-nums leading-none">{week.sessions}</span>
          <span className="mt-0.5 text-[11px] text-muted-foreground">{goal ? `dari ${goal}` : "sesi"}</span>
        </ProgressRing>
        <dl className="flex flex-col gap-2 text-sm">
          <div>
            <dd className="font-semibold tabular-nums">{week.minutes.toLocaleString("id-ID")}</dd>
            <dt className="text-xs text-muted-foreground">menit berlatih</dt>
          </div>
          <div>
            <dd className="font-semibold tabular-nums">{distance(week.distanceM)}</dd>
            <dt className="text-xs text-muted-foreground">jarak</dt>
          </div>
        </dl>
      </div>
      <QuickAddTrigger kind="workout" size="sm" className="w-full">
        Catat latihan
      </QuickAddTrigger>
    </section>
  );
}
