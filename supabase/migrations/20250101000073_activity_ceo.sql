create table account_activity_days (
  account_id uuid not null references accounts(id) on delete cascade,
  day date not null,
  primary key (account_id, day)
);

create index account_activity_days_day_idx on account_activity_days (day);

alter table account_activity_days enable row level security;
revoke all on account_activity_days from anon, authenticated;

create index if not exists workout_logs_created_at_idx on workout_logs (created_at);
create index if not exists posts_created_at_idx on posts (created_at);
create index if not exists stories_created_at_idx on stories (created_at);
create index if not exists dm_messages_created_at_idx on dm_messages (created_at);
create index if not exists friendships_created_at_idx on friendships (created_at);
create index if not exists accounts_created_at_idx on accounts (created_at);
create index if not exists class_bookings_attended_at_idx on class_bookings (attended_at) where is_attended;
create index if not exists checkins_checked_in_at_idx on checkins (checked_in_at);
create index if not exists orders_paid_at_idx on orders (paid_at) where status = 'paid';
create index if not exists resource_bookings_created_at_idx on resource_bookings (created_at);

create function record_activity_day(p_account uuid) returns void as $$
  insert into account_activity_days (account_id, day)
  values (p_account, (now() at time zone 'Asia/Jakarta')::date)
  on conflict do nothing;
$$ language sql security definer set search_path = public;

create function purge_activity_days() returns int as $$
declare v int;
begin
  delete from account_activity_days where day < ((now() at time zone 'Asia/Jakarta')::date - interval '13 months')::date;
  get diagnostics v = row_count;
  return v;
end;
$$ language plpgsql security definer set search_path = public;

create function ceo_counts(p_from date, p_to date) returns jsonb as $$
  with b as (
    select (p_from::timestamp at time zone 'Asia/Jakarta') as ts_from, (p_to::timestamp at time zone 'Asia/Jakarta') as ts_to,
      least(p_to, (now() at time zone 'Asia/Jakarta')::date + 1) as d_end
  )
  select jsonb_build_object(
    'new_accounts', (select count(*) from accounts, b where created_at >= ts_from and created_at < ts_to),
    'new_orgs', (select count(*) from organizations, b where created_at >= ts_from and created_at < ts_to),
    'trials_running', (select count(*) from organization_subscriptions s, b
      where s.trial_ends_at >= b.d_end - 1 and s.created_at < b.ts_to
        and not exists (select 1 from subscription_renewals r where r.organization_id = s.organization_id and r.status = 'paid' and r.paid_at < b.ts_to)),
    'trial_ended', (select count(*) from organization_subscriptions s, b where s.trial_ends_at >= b.d_end - 30 and s.trial_ends_at < b.d_end),
    'trial_converted', (select count(*) from organization_subscriptions s, b where s.trial_ends_at >= b.d_end - 30 and s.trial_ends_at < b.d_end
      and exists (select 1 from subscription_renewals r where r.organization_id = s.organization_id and r.status = 'paid' and r.paid_at < b.ts_to)),
    'wau', (select count(distinct account_id) from account_activity_days, b where day >= b.d_end - 7 and day < b.d_end),
    'mau', (select count(distinct account_id) from account_activity_days, b where day >= b.d_end - 30 and day < b.d_end),
    'workouts', (select count(*) from workout_logs, b where created_at >= ts_from and created_at < ts_to),
    'active_clubs_7d', (select count(distinct club_id) from (
        select club_id from class_bookings, b where is_attended and attended_at >= (b.d_end - 7)::timestamp at time zone 'Asia/Jakarta' and attended_at < b.d_end::timestamp at time zone 'Asia/Jakarta'
        union select club_id from checkins, b where checked_in_at >= (b.d_end - 7)::timestamp at time zone 'Asia/Jakarta' and checked_in_at < b.d_end::timestamp at time zone 'Asia/Jakarta'
        union select club_id from resource_bookings, b where created_at >= (b.d_end - 7)::timestamp at time zone 'Asia/Jakarta' and created_at < b.d_end::timestamp at time zone 'Asia/Jakarta'
        union select club_id from orders, b where status = 'paid' and paid_at >= (b.d_end - 7)::timestamp at time zone 'Asia/Jakarta' and paid_at < b.d_end::timestamp at time zone 'Asia/Jakarta'
      ) x),
    'managed_members', (select count(*) from club_members m, b where m.is_active and m.created_at < b.ts_to),
    'posts', (select count(*) from posts, b where created_at >= ts_from and created_at < ts_to),
    'stories', (select count(*) from stories, b where created_at >= ts_from and created_at < ts_to),
    'messages', (select count(*) from dm_messages, b where created_at >= ts_from and created_at < ts_to),
    'friend_requests', (select count(*) from friendships, b where created_at >= ts_from and created_at < ts_to)
  )
  from b;
$$ language sql stable security definer set search_path = public;

create function ceo_snapshot(p_period text, p_anchor date) returns jsonb as $$
declare
  v_start date;
  v_end date;
  v_prev_start date;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_month date := date_trunc('month', p_anchor)::date;
  v_metrics jsonb;
  v_prev_metrics jsonb;
  v_first_day date;
begin
  if p_period = 'week' then
    v_start := date_trunc('week', p_anchor)::date;
    v_end := v_start + 7;
    v_prev_start := v_start - 7;
  elsif p_period = 'month' then
    v_start := v_month;
    v_end := (v_month + interval '1 month')::date;
    v_prev_start := (v_month - interval '1 month')::date;
  else
    raise exception using errcode = '22023', message = 'Periode harus week atau month';
  end if;

  v_metrics := platform_metrics(v_month);
  v_prev_metrics := case when p_period = 'month'
    then platform_metrics(v_prev_start)
    else jsonb_build_object(
      'mrr', coalesce((select sum(mrr) from platform_org_mrr(least(v_start, v_today) - 1, false)), 0),
      'paying_orgs', (select count(*) from platform_org_mrr(least(v_start, v_today) - 1, false) where mrr > 0)
    )
  end;
  select min(day) into v_first_day from account_activity_days;

  return jsonb_build_object(
    'period', p_period,
    'start', v_start,
    'end', v_end,
    'prev_start', v_prev_start,
    'activity_since', v_first_day,
    'activity_days', case when v_first_day is null then 0 else v_today - v_first_day + 1 end,
    'revenue', jsonb_build_object(
      'mrr', v_metrics -> 'mrr',
      'arr', v_metrics -> 'arr',
      'paying_orgs', v_metrics -> 'paying_orgs',
      'paid_seats', v_metrics -> 'paid_seats',
      'churn_mrr', v_metrics #> '{movement,churn,amount}',
      'prev_mrr', v_prev_metrics -> 'mrr',
      'prev_paying_orgs', v_prev_metrics -> 'paying_orgs',
      'prev_paid_seats', v_prev_metrics -> 'paid_seats',
      'prev_churn_mrr', v_prev_metrics #> '{movement,churn,amount}',
      'month', v_month
    ),
    'current', ceo_counts(v_start, v_end),
    'previous', ceo_counts(v_prev_start, v_start),
    'funnel', (
      select jsonb_build_object(
        'month', v_month,
        'registered', count(*),
        'onboarded', count(*) filter (where exists (select 1 from clubs c where c.organization_id = o.id and c.onboarding_completed_at is not null)),
        'trial', count(*) filter (where s.trial_ends_at is not null),
        'paid', count(*) filter (where exists (select 1 from subscription_renewals r where r.organization_id = o.id and r.status = 'paid'))
      )
      from organizations o
      left join organization_subscriptions s on s.organization_id = o.id
      where o.created_at >= (v_month::timestamp at time zone 'Asia/Jakarta')
        and o.created_at < ((v_month + interval '1 month')::timestamp at time zone 'Asia/Jakarta')
    ),
    'ops', jsonb_build_object(
      'open_reports', (select count(*) from reports where status = 'open'),
      'stale_renewals', (select count(*) from subscription_renewals where status = 'pending' and requested_at < now() - interval '3 days'),
      'failed_payments_7d', (select count(*) from audit_log where action = 'subscription.payment_failed' and at >= now() - interval '7 days'),
      'ending_30d', (select count(*) from platform_ending_soon(30))
    ),
    'top', coalesce((
      select jsonb_agg(t order by t.mrr desc, t.name)
      from (
        select o.name, s.seats, (select ct.name from clubs c join club_types ct on ct.code = c.club_type where c.organization_id = o.id order by c.created_at limit 1) as club_type,
          s.current_period_end as next_renewal, m.mrr
        from platform_org_mrr(v_today, true) m
        join organizations o on o.id = m.organization_id
        join organization_subscriptions s on s.organization_id = o.id
        where m.mrr > 0
        order by m.mrr desc, o.name
        limit 10
      ) t
    ), '[]'::jsonb)
  );
end;
$$ language plpgsql stable security definer set search_path = public;

create function ceo_weekly_trend()
returns table (week_start date, wau bigint, workouts bigint, new_accounts bigint, new_orgs bigint, posts bigint) as $$
  with weeks as (
    select (date_trunc('week', (now() at time zone 'Asia/Jakarta')::date) - (n * interval '1 week'))::date as w
    from generate_series(0, 11) n
  )
  select w,
    (select count(distinct account_id) from account_activity_days where day >= w and day < w + 7),
    (select count(*) from workout_logs where created_at >= w::timestamp at time zone 'Asia/Jakarta' and created_at < (w + 7)::timestamp at time zone 'Asia/Jakarta'),
    (select count(*) from accounts where created_at >= w::timestamp at time zone 'Asia/Jakarta' and created_at < (w + 7)::timestamp at time zone 'Asia/Jakarta'),
    (select count(*) from organizations where created_at >= w::timestamp at time zone 'Asia/Jakarta' and created_at < (w + 7)::timestamp at time zone 'Asia/Jakarta'),
    (select count(*) from posts where created_at >= w::timestamp at time zone 'Asia/Jakarta' and created_at < (w + 7)::timestamp at time zone 'Asia/Jakarta')
  from weeks
  order by w;
$$ language sql stable security definer set search_path = public;

revoke execute on function record_activity_day(uuid) from public, anon, authenticated;
revoke execute on function purge_activity_days() from public, anon, authenticated;
revoke execute on function ceo_counts(date, date) from public, anon, authenticated;
revoke execute on function ceo_snapshot(text, date) from public, anon, authenticated;
revoke execute on function ceo_weekly_trend() from public, anon, authenticated;
grant execute on function record_activity_day(uuid) to service_role;
grant execute on function purge_activity_days() to service_role;
grant execute on function ceo_snapshot(text, date) to service_role;
grant execute on function ceo_weekly_trend() to service_role;
