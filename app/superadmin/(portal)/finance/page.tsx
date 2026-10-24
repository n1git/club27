import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth/superadmin";
import { formatJakartaDate, getJakartaDateString } from "@/lib/format";
import { formatRupiah } from "@/lib/pricing";
import {
  getPlatformMetrics,
  getPlatformPnl,
  listEndingSoon,
  listPaidRenewals,
  listRefunds,
  parseMonth,
  shiftMonth,
} from "@/lib/data/platform-finance";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GatewayFeeForm, RefundDialog } from "@/components/superadmin/finance-forms";
import { MonthPicker } from "./month-picker";

const LONG = { month: "long", year: "numeric" } as const;
const signed = (n: number) => (n > 0 ? `+${formatRupiah(n)}` : n < 0 ? `−${formatRupiah(-n)}` : formatRupiah(0));
const minus = (n: number) => (n === 0 ? formatRupiah(0) : `−${formatRupiah(n)}`);

function change(now: number, before: number) {
  if (now === before) return "sama dengan bulan lalu";
  return `${now > before ? "▲ naik" : "▼ turun"} ${formatRupiah(Math.abs(now - before))} dari bulan lalu`;
}

export default async function PlatformFinancePage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await requireSuperadmin();
  const { bulan } = await searchParams;
  const month = parseMonth(bulan);
  const [metrics, previous, pnl, renewals, refunds, ending] = await Promise.all([
    getPlatformMetrics(month),
    getPlatformMetrics(shiftMonth(month, -1)),
    getPlatformPnl(month),
    listPaidRenewals(month),
    listRefunds(month),
    listEndingSoon(),
  ]);
  const monthName = formatJakartaDate(`${month}T00:00:00+07:00`, LONG);
  const cohort = metrics.trial_cohorts.find((c) => c.month === shiftMonth(month, -1)) ?? metrics.trial_cohorts[0];
  const mv = metrics.movement;
  const today = getJakartaDateString();
  const cash = metrics.cash_paid - metrics.cash_refunds;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Keuangan platform</>} />
      <div className="flex flex-wrap items-end gap-2">
        <MonthPicker month={month} action="/superadmin/finance" />
        <Link href={`/superadmin/finance/expenses?bulan=${month.slice(0, 7)}`} className={buttonVariants({ variant: "outline" })}>
          Biaya dan tarif gateway
        </Link>
        <a href={`/superadmin/finance/export?bulan=${month.slice(0, 7)}`} className={buttonVariants()}>
          Unduh CSV
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard title="MRR" value={formatRupiah(metrics.mrr)} hint={`${change(metrics.mrr, previous.mrr)}. Tarif bulanan langganan lunas yang aktif per ${formatJakartaDate(metrics.reference_date)}.`} />
        <MetricCard title="ARR" value={formatRupiah(metrics.arr)} hint="MRR × 12" />
        <MetricCard title="Pendapatan kas" value={formatRupiah(cash)} hint="Dibayar bulan ini dikurangi refund bulan ini" />
        <MetricCard title="Pendapatan diakui" value={formatRupiah(metrics.recognized)} hint="Bagian periode langganan yang jatuh di bulan ini" />
        <MetricCard title="Laba bersih" value={pnl.net < 0 ? `−${formatRupiah(-pnl.net)}` : formatRupiah(pnl.net)} hint="Diakui − biaya gateway − biaya platform − pajak" />
        <MetricCard
          title="Konversi trial"
          value={cohort && cohort.started > 0 ? `${Math.round((cohort.converted / cohort.started) * 100)}%` : "Belum ada data"}
          hint={cohort ? `${cohort.converted} dari ${cohort.started} trial kohort ${formatJakartaDate(`${cohort.month}T00:00:00+07:00`, LONG)} sudah bayar` : "Belum ada organisasi trial"}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Pendapatan diterima di muka per akhir {monthName}: <strong>{formatRupiah(metrics.deferred)}</strong>. ARPA:{" "}
        {metrics.arpa === null ? "Belum ada data" : formatRupiah(metrics.arpa)}. Seat berbayar: {metrics.paid_seats}.
      </p>

      {pnl.pkp_warning ? (
        <Alert variant="warning">
          <AlertDescription>
            Omzet kas 12 bulan terakhir {formatRupiah(pnl.trailing_cash)} sudah melewati 80% batas PKP {formatRupiah(pnl.pkp_threshold)}. Konsultasikan pendaftaran PKP.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pergerakan MRR</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis</TableHead>
              <TableHead className="text-right">Organisasi</TableHead>
              <TableHead className="text-right">MRR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Awal bulan</TableCell>
              <TableCell className="whitespace-nowrap text-right">{mv.start_orgs}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{formatRupiah(mv.start_mrr)}</TableCell>
            </TableRow>
            {(
              [
                ["Baru", mv.new],
                ["Aktif lagi", mv.reactivated],
                ["Ekspansi", mv.expansion],
                ["Kontraksi", mv.contraction],
                ["Churn", mv.churn],
              ] as const
            ).map(([label, line]) => (
              <TableRow key={label}>
                <TableCell>{label}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{line.orgs}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{signed(line.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell>Akhir bulan</TableCell>
              <TableCell className="whitespace-nowrap text-right">{mv.end_orgs}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{formatRupiah(mv.end_mrr)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Laba rugi {monthName}</h2>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Pendapatan diakui sebelum refund</TableCell>
              <TableCell className="whitespace-nowrap text-right">{formatRupiah(pnl.recognized_gross)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Refund</TableCell>
              <TableCell className="whitespace-nowrap text-right">{minus(pnl.refunds)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                Biaya gateway
                {pnl.gateway_estimated ? <span className="text-xs text-muted-foreground"> ({pnl.gateway_estimated} estimasi)</span> : null}
                {pnl.gateway_unknown ? <span className="text-xs text-muted-foreground"> ({pnl.gateway_unknown} tanpa tarif)</span> : null}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">{minus(pnl.gateway_fees)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Biaya platform</TableCell>
              <TableCell className="whitespace-nowrap text-right">{minus(pnl.expenses)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                {pnl.tax_mode === "umkm_final"
                  ? `Estimasi PPh final ${(pnl.tax_rate * 100).toLocaleString("id-ID")}% dari kas ${formatRupiah(pnl.cash)}`
                  : "Pajak (tidak dihitung)"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">{minus(pnl.tax)}</TableCell>
            </TableRow>
            <TableRow className="font-semibold">
              <TableCell>Laba bersih</TableCell>
              <TableCell className="whitespace-nowrap text-right">{pnl.net < 0 ? `−${formatRupiah(-pnl.net)}` : formatRupiah(pnl.net)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Omzet kas 12 bulan terakhir {formatRupiah(pnl.trailing_cash)} dari batas PKP {formatRupiah(pnl.pkp_threshold)}. Pajak dan biaya gateway adalah estimasi, bukan laporan resmi.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Berakhir dalam 30 hari</h2>
        {ending.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisasi</TableHead>
                <TableHead>Berakhir</TableHead>
                <TableHead className="text-right">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ending.map((row) => (
                <TableRow key={row.organization_id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{formatJakartaDate(row.ends_on)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatRupiah(row.mrr)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Tidak ada.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pembayaran lunas {monthName}</h2>
        {renewals.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kwitansi</TableHead>
                <TableHead>Organisasi</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead className="text-right">Biaya gateway</TableHead>
                <TableHead>Aktual</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {renewals.map((r) => (
                <TableRow key={r.renewal_id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    <Link href={`/superadmin/billing/receipt/${r.renewal_id}`} className="underline underline-offset-4">
                      {r.receipt_number ?? "-"}
                    </Link>
                  </TableCell>
                  <TableCell>{r.organization_name}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {formatRupiah(r.amount)}
                    {r.refunded > 0 ? <div className="text-xs text-muted-foreground">refund {formatRupiah(r.refunded)}</div> : null}
                  </TableCell>
                  <TableCell>{r.payment_method ?? r.payment_type ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {r.gateway_fee === null ? "Tanpa tarif" : formatRupiah(r.gateway_fee)}
                    <div className="text-xs text-muted-foreground">{r.fee_estimated ? "estimasi" : "aktual"}</div>
                  </TableCell>
                  <TableCell>
                    <GatewayFeeForm renewalId={r.renewal_id} actual={r.fee_estimated ? null : r.gateway_fee} />
                  </TableCell>
                  <TableCell>
                    {r.amount - r.refunded > 0 ? (
                      <RefundDialog
                        renewalId={r.renewal_id}
                        label={`${r.organization_name} · ${r.receipt_number ?? ""}`}
                        max={r.amount - r.refunded}
                        today={today}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Sudah direfund penuh</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada pembayaran bulan ini.</p>
        )}
        <p className="text-xs text-muted-foreground">Refund untuk pembayaran bulan lain: pilih bulan pembayarannya.</p>
      </section>

      {refunds.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Refund {monthName}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Organisasi</TableHead>
                <TableHead>Kwitansi</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead>Alasan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refunds.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatJakartaDate(r.refunded_at)}</TableCell>
                  <TableCell>{r.organization_name ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.receipt_number ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatRupiah(r.amount)}</TableCell>
                  <TableCell>{r.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
