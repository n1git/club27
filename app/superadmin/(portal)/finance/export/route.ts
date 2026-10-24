import { NextResponse } from "next/server";
import { requireSuperadminAction } from "@/lib/auth/superadmin";
import { toCsv } from "@/lib/export/csv";
import { buildZip } from "@/lib/export/zip";
import { logAudit } from "@/lib/audit";
import { formatJakartaDateTime } from "@/lib/format";
import { getPlatformPnl, listExpenses, listPaidRenewals, listRefunds, parseMonth } from "@/lib/data/platform-finance";

export async function GET(request: Request) {
  let superadmin: Awaited<ReturnType<typeof requireSuperadminAction>>;
  try {
    superadmin = await requireSuperadminAction();
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }
  const month = parseMonth(new URL(request.url).searchParams.get("bulan") ?? undefined);
  const [pnl, renewals, refunds, expenses] = await Promise.all([getPlatformPnl(month), listPaidRenewals(month), listRefunds(month), listExpenses(month)]);
  const tag = month.slice(0, 7);
  const pnlRows = [
    { baris: "Pendapatan diakui sebelum refund", jumlah: pnl.recognized_gross },
    { baris: "Refund", jumlah: -pnl.refunds },
    { baris: "Biaya gateway", jumlah: -pnl.gateway_fees },
    { baris: "Biaya platform", jumlah: -pnl.expenses },
    { baris: "Estimasi pajak", jumlah: -pnl.tax },
    { baris: "Laba bersih", jumlah: pnl.net },
    { baris: "Pendapatan kas (dibayar dikurangi refund)", jumlah: pnl.cash },
  ];
  const zip = buildZip([
    { name: `laba_rugi_${tag}.csv`, data: toCsv(pnlRows, ["baris", "jumlah"]) },
    {
      name: `pembayaran_${tag}.csv`,
      data: toCsv(
        renewals.map((r) => ({
          nomor_invoice: r.invoice_number,
          nomor_kwitansi: r.receipt_number,
          organisasi: r.organization_name,
          dibayar_wib: formatJakartaDateTime(r.paid_at),
          nominal: r.amount,
          metode: r.payment_method ?? r.payment_type,
          biaya_gateway: r.gateway_fee,
          biaya_gateway_estimasi: r.fee_estimated ? "ya" : "tidak",
          refund: r.refunded,
        })),
        ["nomor_invoice", "nomor_kwitansi", "organisasi", "dibayar_wib", "nominal", "metode", "biaya_gateway", "biaya_gateway_estimasi", "refund"]
      ),
    },
    {
      name: `refund_${tag}.csv`,
      data: toCsv(
        refunds.map((r) => ({ tanggal: r.refunded_at, organisasi: r.organization_name, nomor_kwitansi: r.receipt_number, jumlah: r.amount, cara: r.method, alasan: r.reason })),
        ["tanggal", "organisasi", "nomor_kwitansi", "jumlah", "cara", "alasan"]
      ),
    },
    {
      name: `biaya_${tag}.csv`,
      data: toCsv(
        expenses.map((e) => ({ kategori: e.category, vendor: e.vendor, jumlah_idr: e.amount_idr, jumlah_asli: e.original_amount, mata_uang_asli: e.original_currency, catatan: e.note })),
        ["kategori", "vendor", "jumlah_idr", "jumlah_asli", "mata_uang_asli", "catatan"]
      ),
    },
  ]);
  await logAudit({ action: "platform.finance_export", targetType: "platform", targetId: null, details: { month }, actorId: superadmin.id, actorRole: "superadmin", actorLabel: superadmin.email });
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="keuangan-ruzz-${tag}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
