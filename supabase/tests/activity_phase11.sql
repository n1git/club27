\set ON_ERROR_STOP on
begin;

insert into accounts (email, full_name, password_hash) values ('act1@t.test', 'Act One', 'h'), ('act2@t.test', 'Act Two', 'h');

do $$
declare
  a1 uuid := (select id from accounts where email = 'act1@t.test');
  a2 uuid := (select id from accounts where email = 'act2@t.test');
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  r record;
  snap jsonb;
  v_month date := date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)::date;
begin
  perform record_activity_day(a1);
  perform record_activity_day(a1);
  perform record_activity_day(a1);
  assert (select count(*) from account_activity_days where account_id = a1) = 1, 'three logins in a day give one row';
  assert (select day from account_activity_days where account_id = a1) = v_today, 'day is today in WIB';

  insert into account_activity_days values (a2, v_today - 3), (a2, (v_today - interval '14 months')::date), (a2, (v_today - interval '12 months')::date);
  assert purge_activity_days() = 1, 'only rows older than 13 months are deleted';
  assert (select count(*) from account_activity_days where account_id = a2) = 2, 'recent rows kept';

  snap := ceo_snapshot('week', v_today);
  assert (snap #>> '{current,wau}')::int = 2, 'WAU counts both accounts: ' || (snap #>> '{current,wau}');
  assert (snap #>> '{current,new_accounts}')::int >= 2, 'new accounts this week';

  select * into r from register_organization('Org CEO', 'Club CEO', a1, 'plus', 'monthly', 'swimming');
  insert into subscription_renewals (organization_id, plan_code, billing_period, users, unit_price, months, amount, status, provider, period_start, period_end, paid_at)
  values (r.organization_id, 'plus', 'monthly', 2, 75000, 1, 150000, 'paid', 'manual', v_today, (v_today + interval '1 month')::date, now());
  insert into workout_logs (account_id, sport, performed_on, duration_min) select a1, code, v_today, 30 from club_types limit 1;

  snap := ceo_snapshot('month', v_today);
  assert (snap #>> '{revenue,mrr}')::numeric = (platform_metrics(v_month) ->> 'mrr')::numeric, 'CEO MRR equals finance MRR';
  assert (snap #>> '{revenue,mrr}')::numeric >= 150000, 'MRR includes the new organization';
  assert (snap #>> '{funnel,registered}')::int >= 1 and (snap #>> '{funnel,paid}')::int >= 1, 'funnel counts the organization';
  assert (snap #>> '{current,workouts}')::int >= 1, 'workouts counted';
  assert jsonb_array_length(snap -> 'top') >= 1 and not (snap -> 'top' -> 0 ? 'email'), 'top list has no email';
  assert (select count(*) from ceo_weekly_trend()) = 12, 'twelve weeks of trend';
  begin perform ceo_snapshot('year', v_today); assert false, 'bad period rejected'; exception when sqlstate '22023' then null; end;

  delete from account_activity_days where account_id = a2;
  delete from accounts where id = a2;
  assert not exists (select 1 from account_activity_days where account_id = a2), 'deleting the account removes its rows';
end $$;

set local role authenticated;
do $$
begin
  begin perform * from account_activity_days; assert false, 'activity hidden'; exception when insufficient_privilege then null; end;
  assert not has_function_privilege('authenticated', 'record_activity_day(uuid)', 'execute'), 'writer not callable';
  assert not has_function_privilege('authenticated', 'ceo_snapshot(text, date)', 'execute'), 'snapshot not callable';
  assert not has_function_privilege('anon', 'ceo_weekly_trend()', 'execute'), 'trend not callable';
end $$;
reset role;

rollback;
\echo activity_phase11 OK
