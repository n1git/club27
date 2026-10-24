import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getJakartaDateString } from "@/lib/format";

export type CeoPeriod = "week" | "month";

export interface CeoCounts {
  new_accounts: number;
  new_orgs: number;
  trials_running: number;
  trial_ended: number;
  trial_converted: number;
  wau: number;
  mau: number;
  workouts: number;
  active_clubs_7d: number;
  managed_members: number;
  posts: number;
  stories: number;
  messages: number;
  friend_requests: number;
}

export interface CeoSnapshot {
  period: CeoPeriod;
  start: string;
  end: string;
  prev_start: string;
  activity_since: string | null;
  activity_days: number;
  revenue: {
    mrr: number;
    arr: number;
    paying_orgs: number;
    paid_seats: number;
    churn_mrr: number;
    prev_mrr: number | null;
    prev_paying_orgs: number | null;
    prev_paid_seats: number | null;
    prev_churn_mrr: number | null;
    month: string;
  };
  current: CeoCounts;
  previous: CeoCounts;
  funnel: { month: string; registered: number; onboarded: number; trial: number; paid: number };
  ops: { open_reports: number; stale_renewals: number; failed_payments_7d: number; ending_30d: number };
  top: { name: string; seats: number; club_type: string | null; next_renewal: string | null; mrr: number }[];
}

export interface CeoTrendPoint {
  week_start: string;
  wau: number;
  workouts: number;
  new_accounts: number;
  new_orgs: number;
  posts: number;
}

export async function getCeoSnapshot(period: CeoPeriod): Promise<CeoSnapshot> {
  const { data, error } = await createAdminSupabaseClient().rpc("ceo_snapshot", { p_period: period, p_anchor: getJakartaDateString() });
  if (error) throw new Error("ceo_snapshot failed");
  return data as CeoSnapshot;
}

export async function getCeoTrend(): Promise<CeoTrendPoint[]> {
  const { data } = await createAdminSupabaseClient().rpc("ceo_weekly_trend");
  return ((data ?? []) as CeoTrendPoint[]).map((r) => ({
    week_start: r.week_start,
    wau: Number(r.wau),
    workouts: Number(r.workouts),
    new_accounts: Number(r.new_accounts),
    new_orgs: Number(r.new_orgs),
    posts: Number(r.posts),
  }));
}
