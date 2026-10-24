import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth/superadmin";
import { formatJakartaDate } from "@/lib/format";
import { formatRupiah } from "@/lib/pricing";
import { getCeoSnapshot, getCeoTrend, type CeoPeriod } from "@/lib/data/ceo";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LazyCeoTrendChart } from "@/components/superadmin/lazy-ceo-chart";

const NONE = "Belum ada data";

function compare(now: number, before: number | null | undefined, unit: string, money = false) {
  if (before === null || before === undefined) return "Pembanding belum ada";
  if (now === before) return `sama dengan ${unit}`;
  const diff = Math.abs(now - before);
  return `${now > before ? "▲ naik" : "▼ turun"} ${money ? formatRupiah(diff) : diff.toLocaleString("id-ID")} dari ${unit}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const grid = "grid gap-3 sm:grid-cols-2 lg:grid-cols-4";

export default async function CeoPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await requireSuperadmin();
  const { periode } = await searchParams;
  const period: CeoPeriod = periode === "bulan" ? "month" : "week";
  const [s, trend] = await Promise.all([getCeoSnapshot(period), getCeoTrend()]);
  const unit = period === "week" ? "minggu lalu" : "bulan lalu";
  const c = s.current;
  const p = s.previous;
  const r = s.revenue;
  const days = s.activity_days;
  const conv = (x: { trial_ended: number; trial_converted: number }) => (x.trial_ended > 0 ? Math.round((x.trial_converted / x.trial_ended) * 100) : null);
  const convNow = conv(c);
  const convPrev = conv(p);
  const f = s.funnel;
  const pct = (n: number) => (f.registered > 0 ? `${Math.round((n / f.registered) * 100)}%` : "-");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Dasbor CEO</>} />
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/superadmin/ceo" className={buttonVariants({ variant: period === "week" ? "default" : "outline" })} aria-current={period === "week" ? "page" : undefined}>
          Minggu ini
        </Link>
        <Link href="/superadmin/ceo?periode=bulan" className={buttonVariants({ variant: period === "month" ? "default" : "outline" })} aria-current={period === "month" ? "page" : undefined}>
          Bulan ini
        </Link>
        <span className="text-xs text-muted-foreground">
          {formatJakartaDate(s.start)} – {formatJakartaDate(new Date(Date.parse(s.end) - 86400000))}, dibanding {unit}
        </span>
      </div>

      <Section title="Pendapatan">
        <div className={grid}>
          <MetricCard title="MRR" value={formatRupiah(r.mrr)} hint={`${compare(r.mrr, r.prev_mrr, unit, true)}. Sama dengan halaman Keuangan.`} />
          <MetricCard title="ARR" value={formatRupiah(r.arr)} hint="MRR × 12" />
          <MetricCard title="Organisasi berbayar" value={String(r.paying_orgs)} hint={`${compare(r.paying_orgs, r.prev_paying_orgs, unit)}. MRR lebih dari 0.`} />
          <MetricCard title="Seat berbayar" value={String(r.paid_seats)} hint={`${compare(r.paid_seats, r.prev_paid_seats, unit)}. Seat organisasi berbayar.`} />
          <MetricCard title="Churn MRR bulan ini" value={formatRupiah(Math.abs(r.churn_mrr))} hint="MRR yang hilang dari organisasi yang berhenti" />
        </div>
      </Section>

      <Section title="Pertumbuhan">
        <div className={grid}>
          <MetricCard title="Akun baru" value={c.new_accounts.toLocaleString("id-ID")} hint={`${compare(c.new_accounts, p.new_accounts, unit)}. Akun dibuat di periode ini.`} />
          <MetricCard title="Organisasi baru" value={String(c.new_orgs)} hint={`${compare(c.new_orgs, p.new_orgs, unit)}. Organisasi didaftarkan di periode ini.`} />
          <MetricCard title="Trial berjalan" value={String(c.trials_running)} hint={`${compare(c.trials_running, p.trials_running, unit)}. Trial belum berakhir dan belum bayar.`} />
          <MetricCard
            title="Konversi trial"
            value={convNow === null ? NONE : `${convNow}%`}
            hint={convNow === null ? "Belum ada trial yang berakhir dalam 30 hari" : `${c.trial_converted} dari ${c.trial_ended} trial yang berakhir dalam 30 hari sudah bayar${convPrev === null ? "" : `; sebelumnya ${convPrev}%`}`}
          />
        </div>
      </Section>

      <Section title="Pemakaian">
        <div className={grid}>
          <MetricCard
            title="WAU"
            value={days === 0 ? NONE : c.wau.toLocaleString("id-ID")}
            hint={days === 0 ? "Log hari aktif belum berjalan" : `${days < 7 ? "Data belum lengkap. " : ""}${compare(c.wau, p.wau, unit)}. Akun aktif dalam 7 hari.`}
          />
          <MetricCard
            title="MAU"
            value={days === 0 ? NONE : c.mau.toLocaleString("id-ID")}
            hint={days === 0 ? "Log hari aktif belum berjalan" : `${days < 30 ? `Data belum lengkap (log baru ${days} hari). ` : ""}Akun aktif dalam 30 hari.`}
          />
          <MetricCard
            title="WAU/MAU"
            value={days === 0 || c.mau === 0 ? NONE : `${Math.round((c.wau / c.mau) * 100)}%`}
            hint={days < 30 ? "Data belum lengkap: butuh 30 hari log" : "Seberapa sering akun bulanan kembali tiap minggu"}
          />
          <MetricCard title="Latihan dicatat" value={c.workouts.toLocaleString("id-ID")} hint={`${compare(c.workouts, p.workouts, unit)}. Catatan latihan di periode ini.`} />
          <MetricCard title="Klub aktif 7 hari" value={String(c.active_clubs_7d)} hint={`${compare(c.active_clubs_7d, p.active_clubs_7d, unit)}. Ada kehadiran, check-in, booking, atau pesanan kasir.`} />
          <MetricCard title="Anggota dikelola" value={c.managed_members.toLocaleString("id-ID")} hint={`${compare(c.managed_members, p.managed_members, unit)}. Anggota aktif di semua klub.`} />
        </div>
        <Card>
          <CardContent className="pt-6">
            <LazyCeoTrendChart data={trend} />
          </CardContent>
        </Card>
      </Section>

      <Section title="Sosial (jumlah saja)">
        <div className={grid}>
          <MetricCard title="Post" value={c.posts.toLocaleString("id-ID")} hint={compare(c.posts, p.posts, unit)} />
          <MetricCard title="Cerita" value={c.stories.toLocaleString("id-ID")} hint={compare(c.stories, p.stories, unit)} />
          <MetricCard title="Pesan langsung" value={c.messages.toLocaleString("id-ID")} hint={compare(c.messages, p.messages, unit)} />
          <MetricCard title="Permintaan pertemanan" value={c.friend_requests.toLocaleString("id-ID")} hint={compare(c.friend_requests, p.friend_requests, unit)} />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`Corong klub (kohort ${formatJakartaDate(`${f.month}T00:00:00+07:00`, { month: "long", year: "numeric" })})`}>
          {f.registered ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tahap</TableHead>
                  <TableHead className="text-right">Organisasi</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    ["Daftar", f.registered],
                    ["Onboarding selesai", f.onboarded],
                    ["Trial", f.trial],
                    ["Bayar pertama", f.paid],
                  ] as const
                ).map(([label, n]) => (
                  <TableRow key={label}>
                    <TableCell>{label}</TableCell>
                    <TableCell className="text-right">{n}</TableCell>
                    <TableCell className="text-right">{pct(n)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">{NONE}</p>
          )}
        </Section>

        <Section title="Kesehatan operasional">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Link href="/superadmin/reports" className="underline underline-offset-4">Laporan terbuka</Link>
                </TableCell>
                <TableCell className="text-right">{s.ops.open_reports}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Menunggu bayar lebih dari 3 hari</TableCell>
                <TableCell className="text-right">{s.ops.stale_renewals}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Pembayaran gagal atau kedaluwarsa (7 hari)</TableCell>
                <TableCell className="text-right">{s.ops.failed_payments_7d}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Link href="/superadmin/finance" className="underline underline-offset-4">Berakhir dalam 30 hari</Link>
                </TableCell>
                <TableCell className="text-right">{s.ops.ending_30d}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>
      </div>

      <Section title="10 organisasi teratas menurut MRR">
        {s.top.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisasi</TableHead>
                <TableHead className="text-right">Seat</TableHead>
                <TableHead className="hidden sm:table-cell">Jenis</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="hidden sm:table-cell">Perpanjangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.top.map((t) => (
                <TableRow key={t.name}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell className="text-right">{t.seats}</TableCell>
                  <TableCell className="hidden sm:table-cell">{t.club_type ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatRupiah(t.mrr)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{t.next_renewal ? formatJakartaDate(t.next_renewal) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">{NONE}</p>
        )}
      </Section>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
