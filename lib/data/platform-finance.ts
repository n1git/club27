import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getJakartaDateString } from "@/lib/format";

export interface MovementLine {
  orgs: number;
  amount: number;
}

export interface PlatformMetrics {
  month: string;
  reference_date: string;
  mrr: number;
  arr: number;
  paying_orgs: number;
  paid_seats: number;
  arpa: number | null;
  cash_paid: number;
  cash_refunds: number;
  recognized: number;
  recognized_gross: number;
  deferred: number;
  movement: {
    start_mrr: number;
    start_orgs: number;
    new: MovementLine;
    reactivated: MovementLine;
    expansion: MovementLine;
    contraction: MovementLine;
    churn: MovementLine;
    end_mrr: number;
    end_orgs: number;
  };
  trial_cohorts: { month: string; started: number; converted: number }[];
}

export interface PlatformPnl {
  month: string;
  recognized_gross: number;
  refunds: number;
  recognized: number;
  gateway_fees: number;
  gateway_estimated: number;
  gateway_unknown: number;
  expenses: number;
  cash: number;
  tax_mode: "umkm_final" | "none";
  tax_rate: number;
  tax: number;
  net: number;
  trailing_cash: number;
  pkp_threshold: number;
  pkp_warning: boolean;
}

export interface PaidRenewal {
  renewal_id: string;
  invoice_number: string | null;
  receipt_number: string | null;
  organization_name: string;
  paid_at: string;
  amount: number;
  payment_method: string | null;
  payment_type: string | null;
  gateway_fee: number | null;
  fee_estimated: boolean;
  refunded: number;
}

export interface EndingSoon {
  organization_id: string;
  name: string;
  ends_on: string;
  billing_period: "monthly" | "yearly";
  mrr: number;
}

export interface RefundRow {
  id: string;
  refunded_at: string;
  amount: number;
  reason: string;
  method: string;
  invoice_number: string | null;
  receipt_number: string | null;
  organization_name: string | null;
}

export interface ExpenseRow {
  id: string;
  month: string;
  category: string;
  vendor: string;
  amount_idr: number;
  original_amount: number | null;
  original_currency: string | null;
  note: string | null;
}

export interface FeeRate {
  payment_type: string;
  label: string;
  percent: number;
  fixed_idr: number;
}

export const EXPENSE_CATEGORIES = ["infrastruktur", "alat", "pembayaran", "pemasaran", "hukum", "lainnya"] as const;

export const EXPENSE_LABEL: Record<(typeof EXPENSE_CATEGORIES)[number], string> = {
  infrastruktur: "Infrastruktur",
  alat: "Alat",
  pembayaran: "Pembayaran",
  pemasaran: "Pemasaran",
  hukum: "Hukum",
  lainnya: "Lainnya",
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseMonth(value: string | undefined): string {
  return value && MONTH_RE.test(value) ? `${value}-01` : `${getJakartaDateString().slice(0, 7)}-01`;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 10);
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function getPlatformMetrics(month: string): Promise<PlatformMetrics> {
  const { data, error } = await createAdminSupabaseClient().rpc("platform_metrics", { p_month: month });
  if (error) throw new Error("platform_metrics failed");
  return data as PlatformMetrics;
}

export async function getPlatformPnl(month: string): Promise<PlatformPnl> {
  const { data, error } = await createAdminSupabaseClient().rpc("platform_pnl", { p_month: month });
  if (error) throw new Error("platform_pnl failed");
  return data as PlatformPnl;
}

export async function listPaidRenewals(month: string): Promise<PaidRenewal[]> {
  const { data } = await createAdminSupabaseClient().rpc("platform_paid_renewals", { p_month: month });
  return ((data ?? []) as PaidRenewal[]).map((r) => ({ ...r, amount: Number(r.amount), gateway_fee: num(r.gateway_fee), refunded: Number(r.refunded) }));
}

export async function listEndingSoon(): Promise<EndingSoon[]> {
  const { data } = await createAdminSupabaseClient().rpc("platform_ending_soon", { p_days: 30 });
  return ((data ?? []) as EndingSoon[]).map((r) => ({ ...r, mrr: Number(r.mrr) }));
}

export async function listRefunds(month: string): Promise<RefundRow[]> {
  const { data } = await createAdminSupabaseClient()
    .from("platform_refunds")
    .select("id, refunded_at, amount, reason, method, subscription_renewals(invoice_number, receipt_number, organizations(name))")
    .gte("refunded_at", month)
    .lt("refunded_at", shiftMonth(month, 1))
    .order("refunded_at");
  type Raw = Omit<RefundRow, "invoice_number" | "receipt_number" | "organization_name"> & {
    subscription_renewals: { invoice_number: string | null; receipt_number: string | null; organizations: { name: string } | null } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    refunded_at: r.refunded_at,
    amount: Number(r.amount),
    reason: r.reason,
    method: r.method,
    invoice_number: r.subscription_renewals?.invoice_number ?? null,
    receipt_number: r.subscription_renewals?.receipt_number ?? null,
    organization_name: r.subscription_renewals?.organizations?.name ?? null,
  }));
}

export async function listExpenses(month: string): Promise<ExpenseRow[]> {
  const { data } = await createAdminSupabaseClient()
    .from("platform_expenses")
    .select("id, month, category, vendor, amount_idr, original_amount, original_currency, note")
    .eq("month", month)
    .order("category")
    .order("vendor");
  return ((data ?? []) as ExpenseRow[]).map((r) => ({ ...r, amount_idr: Number(r.amount_idr), original_amount: num(r.original_amount) }));
}

export async function listFeeRates(): Promise<FeeRate[]> {
  const { data } = await createAdminSupabaseClient().from("payment_fee_rates").select("payment_type, label, percent, fixed_idr").order("label");
  return ((data ?? []) as FeeRate[]).map((r) => ({ ...r, percent: Number(r.percent), fixed_idr: Number(r.fixed_idr) }));
}
