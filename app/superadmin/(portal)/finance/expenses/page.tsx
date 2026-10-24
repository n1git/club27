import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth/superadmin";
import { formatJakartaDate } from "@/lib/format";
import { formatRupiah } from "@/lib/pricing";
import { EXPENSE_LABEL, listExpenses, listFeeRates, parseMonth } from "@/lib/data/platform-finance";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyExpensesForm, DeleteExpenseForm, ExpenseForm, FeeRateForm } from "@/components/superadmin/finance-forms";
import { MonthPicker } from "../month-picker";

export default async function PlatformExpensesPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await requireSuperadmin();
  const { bulan } = await searchParams;
  const month = parseMonth(bulan);
  const [expenses, rates] = await Promise.all([listExpenses(month), listFeeRates()]);
  const total = expenses.reduce((sum, e) => sum + e.amount_idr, 0);
  const monthName = formatJakartaDate(`${month}T00:00:00+07:00`, { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Biaya platform</>} />
      <div className="flex flex-wrap items-end gap-2">
        <MonthPicker month={month} action="/superadmin/finance/expenses" />
        <Link href={`/superadmin/finance?bulan=${month.slice(0, 7)}`} className={buttonVariants({ variant: "outline" })}>
          Kembali ke keuangan
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Biaya {monthName} · {formatRupiah(total)}
          </h2>
          <CopyExpensesForm month={month} />
        </div>
        {expenses.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategori</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead>Asli</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL] ?? e.category}</TableCell>
                  <TableCell>{e.vendor}</TableCell>
                  <TableCell className="text-right">{formatRupiah(e.amount_idr)}</TableCell>
                  <TableCell>{e.original_amount !== null ? `${e.original_currency} ${e.original_amount.toLocaleString("id-ID")}` : "-"}</TableCell>
                  <TableCell>{e.note ?? ""}</TableCell>
                  <TableCell>
                    <DeleteExpenseForm id={e.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada biaya bulan ini.</p>
        )}
        <ExpenseForm month={month} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tarif gateway (estimasi)</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Dipakai bila biaya aktual dari laporan settlement Midtrans belum diisi: persen × nominal + biaya tetap. Cocokkan dengan kontrak Midtrans Anda.
        </p>
        <div className="flex flex-col gap-3">
          {rates.map((r) => (
            <FeeRateForm key={r.payment_type} paymentType={r.payment_type} label={r.label} percent={r.percent} fixedIdr={r.fixed_idr} />
          ))}
        </div>
      </section>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
