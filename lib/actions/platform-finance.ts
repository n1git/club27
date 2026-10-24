"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperadminAction } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { EXPENSE_CATEGORIES, shiftMonth } from "@/lib/data/platform-finance";
import { type ActionState } from "./types";

const SESSION_ENDED: ActionState = { ok: false, error: "Sesi Anda berakhir. Masuk ulang sebagai admin platform." };

async function superadminOrNull() {
  try {
    return await requireSuperadminAction();
  } catch {
    return null;
  }
}

async function audit(superadmin: { id: string; email: string }, action: string, targetType: string, targetId: string | null, details: Record<string, unknown>) {
  await logAudit({ action, targetType, targetId, organizationId: null, details, actorId: superadmin.id, actorRole: "superadmin", actorLabel: superadmin.email });
}

const monthField = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "Bulan tidak valid");
const money = (label: string) => z.coerce.number({ message: `${label} tidak valid` }).min(0, `${label} tidak boleh negatif`).max(1e13, `${label} terlalu besar`);
const first = (r: { error: z.ZodError }) => r.error.issues[0]?.message ?? "Data tidak valid";

const expenseSchema = z.object({
  month: monthField,
  category: z.enum(EXPENSE_CATEGORIES, { message: "Pilih kategori" }),
  vendor: z.string().trim().min(1, "Vendor wajib diisi").max(100, "Vendor maksimal 100 karakter"),
  amountIdr: money("Jumlah"),
  originalAmount: z.union([z.literal(""), money("Jumlah asli")]),
  originalCurrency: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Mata uang 3 huruf, misalnya USD")]),
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter"),
});

export async function addExpense(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;
  const parsed = expenseSchema.safeParse({
    month: formData.get("month"),
    category: formData.get("category"),
    vendor: formData.get("vendor") ?? "",
    amountIdr: formData.get("amountIdr"),
    originalAmount: formData.get("originalAmount") ?? "",
    originalCurrency: formData.get("originalCurrency") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { ok: false, error: first(parsed) };
  const d = parsed.data;
  if ((d.originalAmount === "") !== (d.originalCurrency === "")) return { ok: false, error: "Isi jumlah asli dan mata uangnya bersamaan" };
  const row = {
    month: d.month,
    category: d.category,
    vendor: d.vendor,
    amount_idr: d.amountIdr,
    original_amount: d.originalAmount === "" ? null : d.originalAmount,
    original_currency: d.originalCurrency === "" ? null : d.originalCurrency,
    note: d.note || null,
    created_by: superadmin.id,
  };
  const { data, error } = await createAdminSupabaseClient().from("platform_expenses").insert(row).select("id").single();
  if (error) return { ok: false, error: "Biaya gagal disimpan" };
  await audit(superadmin, "platform.expense_add", "platform_expense", data.id as string, { month: d.month, category: d.category, vendor: d.vendor, amount: d.amountIdr });
  revalidatePath("/superadmin/finance");
  return { ok: true, message: "Biaya disimpan" };
}

export async function deleteExpense(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const { data, error } = await createAdminSupabaseClient().from("platform_expenses").delete().eq("id", id.data).select("month, vendor, amount_idr").maybeSingle();
  if (error || !data) return { ok: false, error: "Biaya gagal dihapus" };
  await audit(superadmin, "platform.expense_delete", "platform_expense", id.data, data);
  revalidatePath("/superadmin/finance");
  return { ok: true, message: "Biaya dihapus" };
}

export async function copyExpensesFromLastMonth(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;
  const month = monthField.safeParse(formData.get("month"));
  if (!month.success) return { ok: false, error: "Bulan tidak valid" };
  const supabase = createAdminSupabaseClient();
  const [{ data: previous }, { data: existing }] = await Promise.all([
    supabase.from("platform_expenses").select("category, vendor, amount_idr, original_amount, original_currency, note").eq("month", shiftMonth(month.data, -1)),
    supabase.from("platform_expenses").select("category, vendor").eq("month", month.data),
  ]);
  const taken = new Set((existing ?? []).map((e) => `${e.category}|${e.vendor}`));
  const rows = (previous ?? [])
    .filter((e) => !taken.has(`${e.category}|${e.vendor}`))
    .map((e) => ({ ...e, month: month.data, created_by: superadmin.id }));
  if (!rows.length) return { ok: false, error: "Tidak ada biaya bulan lalu yang belum disalin" };
  const { error } = await supabase.from("platform_expenses").insert(rows);
  if (error) return { ok: false, error: "Biaya gagal disalin" };
  await audit(superadmin, "platform.expense_copy", "platform_expense", null, { month: month.data, rows: rows.length });
  revalidatePath("/superadmin/finance");
  return { ok: true, message: `${rows.length} biaya disalin dari bulan lalu` };
}

const feeRateSchema = z.object({
  paymentType: z.string().regex(/^[a-z_]{2,30}$/, "Jenis pembayaran tidak valid"),
  percent: z.coerce.number({ message: "Persen tidak valid" }).min(0, "Persen tidak valid").max(100, "Persen tidak valid"),
  fixedIdr: money("Biaya tetap"),
});

export async function updateFeeRate(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;
  const parsed = feeRateSchema.safeParse({ paymentType: formData.get("paymentType"), percent: formData.get("percent"), fixedIdr: formData.get("fixedIdr") });
  if (!parsed.success) return { ok: false, error: first(parsed) };
  const { error } = await createAdminSupabaseClient()
    .from("payment_fee_rates")
    .update({ percent: parsed.data.percent, fixed_idr: parsed.data.fixedIdr, updated_at: new Date().toISOString() })
    .eq("payment_type", parsed.data.paymentType);
  if (error) return { ok: false, error: "Tarif gagal disimpan" };
  await audit(superadmin, "platform.fee_rate_update", "payment_fee_rate", null, parsed.data);
  revalidatePath("/superadmin/finance");
  return { ok: true, message: "Tarif disimpan" };
}

const gatewayFeeSchema = z.object({ renewalId: z.string().uuid(), fee: z.union([z.literal(""), money("Biaya gateway")]) });

export async function setGatewayFee(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;
  const parsed = gatewayFeeSchema.safeParse({ renewalId: formData.get("renewalId"), fee: formData.get("fee") ?? "" });
  if (!parsed.success) return { ok: false, error: first(parsed) };
  const fee = parsed.data.fee === "" ? null : parsed.data.fee;
  const { error } = await createAdminSupabaseClient()
    .from("subscription_renewals")
    .update({ gateway_fee_actual: fee })
    .eq("id", parsed.data.renewalId)
    .eq("status", "paid");
  if (error) return { ok: false, error: "Biaya gateway gagal disimpan" };
  await audit(superadmin, "platform.gateway_fee_set", "renewal", parsed.data.renewalId, { fee });
  revalidatePath("/superadmin/finance");
  return { ok: true, message: fee === null ? "Kembali memakai estimasi" : "Biaya gateway aktual disimpan" };
}

const refundSchema = z.object({
  renewalId: z.string().uuid(),
  amount: z.coerce.number({ message: "Jumlah tidak valid" }).positive("Jumlah harus lebih dari 0").max(1e13, "Jumlah terlalu besar"),
  reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500, "Alasan maksimal 500 karakter"),
  refundedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  method: z.enum(["midtrans", "transfer", "lainnya"], { message: "Pilih cara refund" }),
});

export async function recordRefund(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;
  const parsed = refundSchema.safeParse({
    renewalId: formData.get("renewalId"),
    amount: formData.get("amount"),
    reason: formData.get("reason") ?? "",
    refundedAt: formData.get("refundedAt"),
    method: formData.get("method"),
  });
  if (!parsed.success) return { ok: false, error: first(parsed) };
  const d = parsed.data;
  const { data, error } = await createAdminSupabaseClient().rpc("refund_renewal", {
    p_renewal: d.renewalId,
    p_amount: d.amount,
    p_reason: d.reason,
    p_refunded_at: d.refundedAt,
    p_method: d.method,
    p_actor: superadmin.id,
  });
  if (error) return { ok: false, error: error.code === "RF001" || error.code === "RF002" ? error.message : "Refund gagal dicatat" };
  await audit(superadmin, "platform.refund", "renewal", d.renewalId, { refund: data, amount: d.amount, method: d.method, refundedAt: d.refundedAt });
  revalidatePath("/superadmin/finance");
  return { ok: true, message: "Refund dicatat. Kembalikan uangnya manual di Midtrans atau lewat transfer." };
}
