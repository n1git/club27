create table platform_expenses (
  id uuid primary key default gen_random_uuid(),
  month date not null check (month = date_trunc('month', month)::date),
  category text not null check (category in ('infrastruktur', 'alat', 'pembayaran', 'pemasaran', 'hukum', 'lainnya')),
  vendor text not null check (char_length(vendor) between 1 and 100),
  amount_idr numeric(16, 2) not null check (amount_idr >= 0),
  original_amount numeric(16, 2) check (original_amount >= 0),
  original_currency text check (original_currency ~ '^[A-Z]{3}$'),
  note text check (char_length(note) <= 500),
  created_by uuid references superadmins(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((original_amount is null) = (original_currency is null))
);

create index platform_expenses_month_idx on platform_expenses (month);

create table payment_fee_rates (
  payment_type text primary key check (payment_type ~ '^[a-z_]{2,30}$'),
  label text not null check (char_length(label) between 1 and 60),
  percent numeric(6, 3) not null default 0 check (percent between 0 and 100),
  fixed_idr numeric(12, 2) not null default 0 check (fixed_idr >= 0),
  updated_at timestamptz not null default now()
);

insert into payment_fee_rates (payment_type, label, percent, fixed_idr) values
  ('qris', 'QRIS', 0.7, 0),
  ('bank_transfer', 'Virtual Account', 0, 4000),
  ('echannel', 'Mandiri Bill', 0, 4000),
  ('credit_card', 'Kartu kredit/debit', 2.9, 2000),
  ('gopay', 'GoPay', 2, 0),
  ('shopeepay', 'ShopeePay', 2, 0),
  ('cstore', 'Gerai retail', 0, 5000),
  ('manual', 'Konfirmasi manual', 0, 0);

alter table subscription_renewals
  add column gateway_fee_actual numeric(12, 2) check (gateway_fee_actual >= 0),
  add column payment_type text check (payment_type ~ '^[a-z_]{2,30}$');

update subscription_renewals set payment_type = 'manual' where status = 'paid' and provider = 'manual' and payment_type is null;

create table platform_refunds (
  id uuid primary key default gen_random_uuid(),
  renewal_id uuid not null references subscription_renewals(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  reason text not null check (char_length(reason) between 5 and 500),
  refunded_at date not null,
  method text not null check (method in ('midtrans', 'transfer', 'lainnya')),
  created_by uuid references superadmins(id) on delete set null,
  created_at timestamptz not null default now()
);

create index platform_refunds_renewal_idx on platform_refunds (renewal_id);
create index platform_refunds_date_idx on platform_refunds (refunded_at);

alter table billing_issuer
  add column tax_mode text not null default 'umkm_final' check (tax_mode in ('umkm_final', 'none')),
  add column umkm_rate numeric(6, 4) not null default 0.005 check (umkm_rate between 0 and 1),
  add column pkp_threshold numeric(16, 2) not null default 4800000000 check (pkp_threshold > 0);

alter table platform_expenses enable row level security;
alter table payment_fee_rates enable row level security;
alter table platform_refunds enable row level security;
revoke all on platform_expenses, payment_fee_rates, platform_refunds from anon, authenticated;

create index if not exists subscription_renewals_paid_at_idx on subscription_renewals (paid_at) where status = 'paid';

create function billing_cover_in_month(p_from date, p_to date, p_month date) returns numeric as $$
  select greatest(least(p_to, (p_month + interval '1 month')::date) - greatest(p_from, p_month), 0)::numeric
    / ((p_month + interval '1 month')::date - p_month);
$$ language sql immutable set search_path = public;

create function billing_cover(p_from date, p_to date) returns numeric as $$
  select coalesce(sum(billing_cover_in_month(p_from, p_to, g.m::date)), 0)
  from generate_series(date_trunc('month', p_from), date_trunc('month', p_to - 1), interval '1 month') g(m)
  where p_to > p_from;
$$ language sql immutable set search_path = public;

create function platform_segments(p_with_refunds boolean default true)
returns table (renewal_id uuid, organization_id uuid, kind text, seg_from date, seg_to date, rate numeric, extra_month date, extra_amount numeric) as $$
declare
  r record;
  f record;
  v_rate numeric;
  v_from date;
  v_d date;
  v_cover numeric;
  v_value numeric;
begin
  for r in
    select s.id, s.organization_id, s.amount, s.period_start, s.period_end
    from subscription_renewals s
    where s.status = 'paid' and s.period_start is not null and s.period_end > s.period_start
  loop
    v_rate := r.amount / billing_cover(r.period_start, r.period_end);
    v_from := r.period_start;
    if p_with_refunds then
      for f in select pr.amount, pr.refunded_at from platform_refunds pr where pr.renewal_id = r.id order by pr.refunded_at, pr.created_at, pr.id loop
        v_d := greatest(f.refunded_at, r.period_start);
        if v_d >= r.period_end then
          renewal_id := r.id; organization_id := r.organization_id; kind := 'extra';
          seg_from := null; seg_to := null; rate := null;
          extra_month := date_trunc('month', f.refunded_at)::date; extra_amount := -f.amount;
          return next;
          continue;
        end if;
        if v_d > v_from then
          renewal_id := r.id; organization_id := r.organization_id; kind := 'seg';
          seg_from := v_from; seg_to := v_d; rate := v_rate; extra_month := null; extra_amount := null;
          return next;
          v_from := v_d;
        end if;
        v_cover := billing_cover(v_d, r.period_end);
        v_value := v_rate * v_cover;
        if f.amount <= v_value then
          v_rate := (v_value - f.amount) / v_cover;
        else
          v_rate := 0;
          renewal_id := r.id; organization_id := r.organization_id; kind := 'extra';
          seg_from := null; seg_to := null; rate := null;
          extra_month := date_trunc('month', f.refunded_at)::date; extra_amount := -(f.amount - v_value);
          return next;
        end if;
      end loop;
    end if;
    renewal_id := r.id; organization_id := r.organization_id; kind := 'seg';
    seg_from := v_from; seg_to := r.period_end; rate := v_rate; extra_month := null; extra_amount := null;
    return next;
  end loop;
end;
$$ language plpgsql stable security definer set search_path = public;

create function platform_recognition(p_with_refunds boolean default true)
returns table (renewal_id uuid, organization_id uuid, month date, amount numeric) as $$
  with seg as (
    select * from platform_segments(p_with_refunds)
  ),
  raw as (
    select s.renewal_id, s.organization_id, m::date as month, s.rate * billing_cover_in_month(s.seg_from, s.seg_to, m::date) as v
    from seg s
    cross join lateral generate_series(date_trunc('month', s.seg_from), date_trunc('month', s.seg_to - 1), interval '1 month') m
    where s.kind = 'seg'
    union all
    select s.renewal_id, s.organization_id, s.extra_month, s.extra_amount from seg s where s.kind = 'extra'
  ),
  monthly as (
    select raw.renewal_id, raw.organization_id, raw.month, sum(raw.v) as v from raw group by 1, 2, 3
  ),
  target as (
    select sr.id, sr.amount - case when p_with_refunds then coalesce((select sum(pr.amount) from platform_refunds pr where pr.renewal_id = sr.id), 0) else 0 end as total
    from subscription_renewals sr
    where sr.status = 'paid'
  ),
  rounded as (
    select m.renewal_id, m.organization_id, m.month, round(m.v) as rv,
      row_number() over (partition by m.renewal_id order by m.month desc) as rn,
      sum(round(m.v)) over (partition by m.renewal_id) as srv,
      t.total
    from monthly m join target t on t.id = m.renewal_id
  )
  select renewal_id, organization_id, month, case when rn = 1 then rv + (total - srv) else rv end
  from rounded;
$$ language sql stable security definer set search_path = public;

create function platform_reference_date(p_month date) returns date as $$
  select case
    when date_trunc('month', p_month)::date = date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)::date
      then (now() at time zone 'Asia/Jakarta')::date
    else ((date_trunc('month', p_month) + interval '1 month')::date - 1)
  end;
$$ language sql stable set search_path = public;

create function platform_org_mrr(p_ref date, p_exclude_suspended boolean default false)
returns table (organization_id uuid, mrr numeric) as $$
  select s.organization_id, sum(round(s.rate))
  from platform_segments(true) s
  where s.kind = 'seg' and s.seg_from <= p_ref and p_ref < s.seg_to and s.rate > 0
    and (not p_exclude_suspended or coalesce(subscription_phase(s.organization_id), '') <> 'suspended')
  group by s.organization_id;
$$ language sql stable security definer set search_path = public;

create function platform_metrics(p_month date) returns jsonb as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_next date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_prev date := (date_trunc('month', p_month) - interval '1 month')::date;
  v_current boolean := v_month = date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)::date;
  v_ref date := platform_reference_date(v_month);
  v_prev_ref date := v_month - 1;
  v_result jsonb;
begin
  with cur as (select * from platform_org_mrr(v_ref, v_current)),
  prev as (select * from platform_org_mrr(v_prev_ref, false)),
  joined as (
    select coalesce(c.organization_id, p.organization_id) as organization_id, coalesce(p.mrr, 0) as before, coalesce(c.mrr, 0) as after
    from cur c full join prev p on p.organization_id = c.organization_id
  ),
  moves as (
    select j.*,
      case
        when j.before = 0 and j.after > 0 then
          case when exists (select 1 from subscription_renewals sr where sr.organization_id = j.organization_id and sr.status = 'paid' and sr.period_start <= v_prev_ref) then 'reactivated' else 'new' end
        when j.before > 0 and j.after = 0 then 'churn'
        when j.after > j.before then 'expansion'
        when j.after < j.before then 'contraction'
        else 'flat'
      end as move
    from joined j
  ),
  rec as (select * from platform_recognition(true)),
  rec_gross as (select * from platform_recognition(false)),
  cohorts as (
    select date_trunc('month', s.created_at at time zone 'Asia/Jakarta')::date as cohort,
      count(*) as started,
      count(*) filter (where exists (select 1 from subscription_renewals sr where sr.organization_id = s.organization_id and sr.status = 'paid')) as converted
    from organization_subscriptions s
    where s.trial_ends_at is not null
      and s.created_at at time zone 'Asia/Jakarta' < v_next
      and s.created_at at time zone 'Asia/Jakarta' >= (v_month - interval '5 months')
    group by 1
  )
  select jsonb_build_object(
    'month', v_month,
    'reference_date', v_ref,
    'mrr', coalesce((select sum(mrr) from cur), 0),
    'arr', coalesce((select sum(mrr) from cur), 0) * 12,
    'paying_orgs', (select count(*) from cur where mrr > 0),
    'paid_seats', coalesce((select sum(os.seats) from organization_subscriptions os join cur on cur.organization_id = os.organization_id where cur.mrr > 0), 0),
    'arpa', case when (select count(*) from cur where mrr > 0) > 0 then round((select sum(mrr) from cur) / (select count(*) from cur where mrr > 0)) else null end,
    'cash_paid', coalesce((select sum(amount) from subscription_renewals where status = 'paid' and (paid_at at time zone 'Asia/Jakarta')::date >= v_month and (paid_at at time zone 'Asia/Jakarta')::date < v_next), 0),
    'cash_refunds', coalesce((select sum(amount) from platform_refunds where refunded_at >= v_month and refunded_at < v_next), 0),
    'recognized', coalesce((select sum(amount) from rec where month = v_month), 0),
    'recognized_gross', coalesce((select sum(amount) from rec_gross where month = v_month), 0),
    'deferred', coalesce((select sum(sr.amount) from subscription_renewals sr where sr.status = 'paid' and (sr.paid_at at time zone 'Asia/Jakarta')::date < v_next), 0)
      - coalesce((select sum(pr.amount) from platform_refunds pr join subscription_renewals sr on sr.id = pr.renewal_id where sr.status = 'paid' and pr.refunded_at < v_next and (sr.paid_at at time zone 'Asia/Jakarta')::date < v_next), 0)
      - coalesce((select sum(rec.amount) from rec join subscription_renewals sr on sr.id = rec.renewal_id where rec.month < v_next and (sr.paid_at at time zone 'Asia/Jakarta')::date < v_next), 0),
    'movement', jsonb_build_object(
      'start_mrr', coalesce((select sum(mrr) from prev), 0),
      'start_orgs', (select count(*) from prev where mrr > 0),
      'new', jsonb_build_object('orgs', (select count(*) from moves where move = 'new'), 'amount', coalesce((select sum(after) from moves where move = 'new'), 0)),
      'reactivated', jsonb_build_object('orgs', (select count(*) from moves where move = 'reactivated'), 'amount', coalesce((select sum(after) from moves where move = 'reactivated'), 0)),
      'expansion', jsonb_build_object('orgs', (select count(*) from moves where move = 'expansion'), 'amount', coalesce((select sum(after - before) from moves where move = 'expansion'), 0)),
      'contraction', jsonb_build_object('orgs', (select count(*) from moves where move = 'contraction'), 'amount', coalesce((select sum(after - before) from moves where move = 'contraction'), 0)),
      'churn', jsonb_build_object('orgs', (select count(*) from moves where move = 'churn'), 'amount', coalesce((select sum(-before) from moves where move = 'churn'), 0)),
      'end_mrr', coalesce((select sum(mrr) from cur), 0),
      'end_orgs', (select count(*) from cur where mrr > 0)
    ),
    'trial_cohorts', coalesce((select jsonb_agg(jsonb_build_object('month', cohort, 'started', started, 'converted', converted) order by cohort desc) from cohorts), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$ language plpgsql stable security definer set search_path = public;

create function platform_pnl(p_month date) returns jsonb as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_next date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_metrics jsonb := platform_metrics(v_month);
  v_issuer billing_issuer%rowtype;
  v_gateway numeric;
  v_estimated int;
  v_unknown int;
  v_expenses numeric;
  v_cash numeric;
  v_tax numeric;
  v_trailing numeric;
  v_net numeric;
begin
  select * into v_issuer from billing_issuer limit 1;
  select
    coalesce(sum(coalesce(sr.gateway_fee_actual, round(sr.amount * r.percent / 100 + r.fixed_idr))), 0),
    count(*) filter (where sr.gateway_fee_actual is null and r.payment_type is not null),
    count(*) filter (where sr.gateway_fee_actual is null and r.payment_type is null)
  into v_gateway, v_estimated, v_unknown
  from subscription_renewals sr
  left join payment_fee_rates r on r.payment_type = sr.payment_type
  where sr.status = 'paid' and (sr.paid_at at time zone 'Asia/Jakarta')::date >= v_month and (sr.paid_at at time zone 'Asia/Jakarta')::date < v_next;

  select coalesce(sum(amount_idr), 0) into v_expenses from platform_expenses where month = v_month;
  v_cash := (v_metrics ->> 'cash_paid')::numeric - (v_metrics ->> 'cash_refunds')::numeric;
  v_tax := case when v_issuer.tax_mode = 'umkm_final' then round(greatest(v_cash, 0) * v_issuer.umkm_rate) else 0 end;
  select
    coalesce((select sum(amount) from subscription_renewals where status = 'paid' and (paid_at at time zone 'Asia/Jakarta')::date >= (v_next - interval '12 months')::date and (paid_at at time zone 'Asia/Jakarta')::date < v_next), 0)
    - coalesce((select sum(amount) from platform_refunds where refunded_at >= (v_next - interval '12 months')::date and refunded_at < v_next), 0)
  into v_trailing;
  v_net := (v_metrics ->> 'recognized')::numeric - v_gateway - v_expenses - v_tax;

  return jsonb_build_object(
    'month', v_month,
    'recognized_gross', (v_metrics ->> 'recognized_gross')::numeric,
    'refunds', (v_metrics ->> 'recognized_gross')::numeric - (v_metrics ->> 'recognized')::numeric,
    'recognized', (v_metrics ->> 'recognized')::numeric,
    'gateway_fees', v_gateway,
    'gateway_estimated', v_estimated,
    'gateway_unknown', v_unknown,
    'expenses', v_expenses,
    'cash', v_cash,
    'tax_mode', v_issuer.tax_mode,
    'tax_rate', v_issuer.umkm_rate,
    'tax', v_tax,
    'net', v_net,
    'trailing_cash', v_trailing,
    'pkp_threshold', v_issuer.pkp_threshold,
    'pkp_warning', v_trailing > 0.8 * v_issuer.pkp_threshold
  );
end;
$$ language plpgsql stable security definer set search_path = public;

create function platform_ending_soon(p_days int default 30)
returns table (organization_id uuid, name text, ends_on date, billing_period text, mrr numeric) as $$
  with today as (select (now() at time zone 'Asia/Jakarta')::date as d),
  m as (select * from platform_org_mrr((select d from today), true))
  select o.id, o.name, s.current_period_end, s.billing_period, coalesce(m.mrr, 0)
  from organization_subscriptions s
  join organizations o on o.id = s.organization_id
  left join m on m.organization_id = s.organization_id
  where s.status = 'active'
    and s.current_period_end between (select d from today) and (select d from today) + p_days
  order by s.current_period_end, o.name;
$$ language sql stable security definer set search_path = public;

create function refund_renewal(p_renewal uuid, p_amount numeric, p_reason text, p_refunded_at date, p_method text, p_actor uuid)
returns uuid as $$
declare
  r subscription_renewals%rowtype;
  v_refunded numeric;
  v_id uuid;
begin
  select * into r from subscription_renewals where id = p_renewal for update;
  if r.id is null or r.status <> 'paid' then
    raise exception using errcode = 'RF001', message = 'Hanya tagihan lunas yang bisa direfund';
  end if;
  select coalesce(sum(amount), 0) into v_refunded from platform_refunds where renewal_id = p_renewal;
  if p_amount is null or p_amount <= 0 or p_amount > r.amount - v_refunded then
    raise exception using errcode = 'RF002', message = format('Refund maksimal %s', r.amount - v_refunded);
  end if;
  insert into platform_refunds (renewal_id, amount, reason, refunded_at, method, created_by)
  values (p_renewal, p_amount, p_reason, p_refunded_at, p_method, p_actor)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function billing_cover(date, date) from public, anon, authenticated;
revoke execute on function billing_cover_in_month(date, date, date) from public, anon, authenticated;
revoke execute on function platform_segments(boolean) from public, anon, authenticated;
revoke execute on function platform_recognition(boolean) from public, anon, authenticated;
revoke execute on function platform_reference_date(date) from public, anon, authenticated;
revoke execute on function platform_org_mrr(date, boolean) from public, anon, authenticated;
revoke execute on function platform_metrics(date) from public, anon, authenticated;
revoke execute on function platform_pnl(date) from public, anon, authenticated;
revoke execute on function platform_ending_soon(int) from public, anon, authenticated;
revoke execute on function refund_renewal(uuid, numeric, text, date, text, uuid) from public, anon, authenticated;
grant execute on function platform_metrics(date) to service_role;
grant execute on function platform_pnl(date) to service_role;
grant execute on function platform_ending_soon(int) to service_role;
grant execute on function platform_recognition(boolean) to service_role;
grant execute on function refund_renewal(uuid, numeric, text, date, text, uuid) to service_role;
