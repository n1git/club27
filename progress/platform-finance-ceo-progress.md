# platform-finance-ceo

Status: Phase 0 approved 2026-10-24 (all five decisions OK). Phase 1 done locally; migration 072 is NOT applied to hosted. Migration numbers moved to 072 (finance) and 073 (activity) because 071 is `profile_bio_badges`.

## Phases

- [x] Phase 0: plan, metric definitions, worked examples, mocks (this file, `platform-finance-ceo/`). Owner OK 2026-10-24.
- [x] Phase 1: migration `20250101000072_platform_finance.sql` and `supabase/tests/finance_phase10.sql` (every number in the worked example, mid-month start, partial and full refund, RF001/RF002, gateway fee actual vs estimate, UMKM tax, P&L, client access denied). All 19 suites pass on a fresh database. Hosted dry run (begin/rollback) of the table and column changes passed; the functions were only run locally because a 20 KB payload through the Supabase MCP tends to hang. Not applied.
- [ ] Phase 2 (code held until 072 is applied): `/superadmin/finance`, expenses, gateway rates, refunds, CSV, replace the revenue card on `/superadmin`.
- [ ] Phase 3: migration `20250101000073_activity_ceo.sql` and tests; activity log writer, cron step, account export, DPIA, `lib/consent.ts`, `/privacy`.
- [ ] Phase 4: `/superadmin/ceo` and the top bar link.

## Definitions

All amounts in rupiah, months in WIB. One SQL function computes each number; the pages, the CSV and the tests read the same function.

**Paid period.** Each `subscription_renewals` row with `status = 'paid'` covers `[period_start, period_end)`. The end day is excluded because `period_end = period_start + 1 month/1 year` and the next period starts the day after, so a yearly period counts exactly 12 months.

**Coverage of a calendar month.** `cover(r, m)` = days of month `m` inside the period ÷ days in `m`. A month fully inside the period has cover 1.

**Monthly rate.** `rate(r) = amount ÷ Σ cover(r, m)` over all months. Yearly Rp750.000 → Σ cover = 12 → Rp62.500. Seat purchase: the same formula over its remaining days, so its rate equals the normal monthly price of those seats.

**Recognized revenue (diakui)** for month `m` = Σ `rate(r) × cover(r, m)`, minus refund adjustments (below). Rounded to rupiah per renewal per month; the last covered month takes the rounding remainder so a renewal always sums to its amount.

**Deferred revenue (diterima di muka)** at the end of `m` = Σ (amount − refunds − recognized up to and including `m`) over paid renewals.

**Cash revenue (kas)** for `m` = Σ `amount` with `paid_at` in `m` − Σ refunds with `refunded_at` in `m`.

**MRR** for `m` = Σ `rate(r)` (after refund adjustment) for paid renewals that cover the last day of `m`; for the current month, the period must cover today. Organizations whose `subscription_phase` is `suspended` are excluded for the current month. ARR = MRR × 12.

**MRR movement** (per organization, MRR at the end of the previous month → this month):
- Baru: 0 → more than 0, and the organization never had MRR before.
- Aktif lagi: 0 → more than 0 for an organization that had MRR before (shown in its own row so "Baru" stays clean).
- Ekspansi: up, both above 0 (seat purchase, more seats at renewal, monthly to yearly at a higher rate).
- Kontraksi: down, both above 0.
- Churn: more than 0 → 0.

**Trial conversion.** Cohort = organizations whose subscription row was created in month `m` with status trial. Converted = the organization has any paid renewal (any time so far). Shown per cohort month; the CEO card uses the cohort of the last 30 days that has already passed its trial end, so young trials do not drag the rate down.

**ARPA** = MRR ÷ organizations with MRR > 0. **Paid seats** = Σ `organization_subscriptions.seats` for those organizations.

**Refund** (`platform_refunds`, recorded only): amount ≤ renewal amount − earlier refunds, reason required. Cash: −amount in the refund month. Recognized: the unrecognized remainder after the refund date is reduced by the refund; if the refund is larger than that remainder, the difference is a negative line in the refund month. Invoice and receipt rows are not touched.

**Gateway fee.** Actual (`subscription_renewals.gateway_fee_actual`, entered from the Midtrans settlement report) when filled; otherwise estimate = `percent × amount + fixed` from `payment_fee_rates`, marked "estimasi". Counted in the month of `paid_at`. Needs a new `payment_type` column (Midtrans raw type: `qris`, `bank_transfer`, `credit_card`, `gopay`, ...; `manual` for superadmin confirmation) saved by the webhook, because the existing `payment_method` is a display label. Old rows: `manual` unless the label says otherwise.

**Tax estimate.** `billing_issuer.tax_mode` (`umkm_final` | `none`), `umkm_rate`, `pkp_threshold`. PPh final = `umkm_rate × cash revenue` of the month. Warning when cash revenue of the last 12 months exceeds 80% of `pkp_threshold`.

**Profit and loss for `m`** = recognized revenue − gateway fees − platform expenses − tax estimate. Refunds are already inside recognized revenue, and shown as their own line.

## Worked example (tested in Phase 1)

Price Rp75.000/seat/month, yearly = 10 months paid. Month under test: November 2026.

| | Organization A, monthly | Organization B, yearly | Organization B, seat purchase |
|---|---|---|---|
| What | 2 seats monthly | 1 seat yearly | +1 seat on 1 Feb 2027 |
| Amount | Rp150.000 | Rp750.000 | Rp750.000 × 273/365 = Rp560.959 (prorata from `seat_quote`) |
| Paid | 1 Nov 2026 | 1 Nov 2026 | 1 Feb 2027 |
| Period | 1 Nov – 1 Dec 2026 | 1 Nov 2026 – 1 Nov 2027 | 1 Feb – 1 Nov 2027 |
| Rate | 150.000 | 62.500 | 560.959 ÷ 9 months = 62.328,8 |

November 2026: MRR = 150.000 + 62.500 = **212.500**; ARR **2.550.000**; cash = 150.000 + 750.000 = **900.000**; recognized = 150.000 + 62.500 = **212.500**; deferred at 30 Nov = 750.000 − 62.500 = **687.500**.

February 2027 (A renews monthly each month): MRR = 150.000 + 62.500 + 62.329 = **274.829** (movement: expansion +62.329 for B); cash = 150.000 + 560.959 = **710.959**; recognized = **274.829** (the seat purchase recognizes 62.329 in Feb–Sep and 62.327 in October so it sums to 560.959); deferred at 28 Feb = (750.000 − 4 × 62.500) + (560.959 − 62.329) = 500.000 + 498.630 = **998.630**.

Mid-month start (B pays on 24 Oct instead): October cover 8/31 → recognized 16.129; every full month 62.500; October 2027 gets the remainder 46.371. Total 750.000.

Refund of Rp300.000 on B on 1 May 2027 (6 months left of 750.000 period): cash May −300.000; remaining recognition 375.000 → 75.000, so May–Oct 2027 recognize 12.500 each; MRR of B drops to 12.500 (contraction). Full refund on the same date: remaining recognition 375.000 → 0, plus −375.000 in May (the part already recognized); MRR 0 (churn). Invoice and receipt unchanged.

## Schema (Phase 1 and 3, service role only, no `club_id`)

- `platform_expenses`, `payment_fee_rates`, `platform_refunds` as in the task; `subscription_renewals.gateway_fee_actual`, `payment_type`; `billing_issuer.tax_mode`, `umkm_rate`, `pkp_threshold` (seed `umkm_final`, 0.005, 4.800.000.000; the owner can change them).
- `gateway_fee_actual` and `payment_type` are outside the `IV001` lock; everything else stays locked.
- Functions: `platform_recognition(p_from, p_to)` (rows per renewal per month), `platform_metrics(p_month)`, `platform_pnl(p_month)`, `refund_renewal(...)` (RPC), `ceo_snapshot(p_period, p_anchor)`, `ceo_weekly_trend()`. All revoked from `public`, `anon`, `authenticated`.
- `account_activity_days (account_id, day)`; index on `day`; `workout_logs(created_at)` index if missing. Cron deletes rows older than 13 months.

## CEO sources

- Social: `posts`, `stories`, `dm_messages`, `friendships` (counts only).
- Club activity in 7 days: `class_bookings.is_attended`, `checkins`, `resource_bookings`, paid `orders`.
- Operations: open `reports`, pending renewals older than 3 days, pending renewals whose Midtrans link was cleared after `expire`/`cancel`/`deny`/`failure` (counted from the audit log, no new table), organizations ending in 30 days.

## Mocks

`progress/platform-finance-ceo/` (sample numbers, labelled "Contoh data"):
- `finance-desktop.png`, `finance-mobile.png`
- `ceo-desktop.png`, `ceo-mobile.png`

## Decisions for the owner

1. Recognized revenue follows the "full month = 1/12" rule above (matches your Rp62.500 example) instead of pure per-day accrual.
2. `payment_type` column added so gateway fee rates match reliably.
3. Trial conversion on the CEO page uses trials that have already ended in the last 30 days.
4. UMKM tax: PPh final 0,5% applies to the gross receipts; the Rp500 juta exemption exists only for individual taxpayers. The rate and threshold are data, so this can be set to match N-1 Labs' actual status.
5. "Pembayaran Midtrans gagal atau kedaluwarsa" is counted from the audit log; today the webhook clears the link without an audit row, so Phase 1 adds one audit row per failed or expired payment.
