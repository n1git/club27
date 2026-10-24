\set ON_ERROR_STOP on
begin;

insert into accounts (email, full_name, password_hash) values ('fa@t.test', 'FA', 'h'), ('fb@t.test', 'FB', 'h'), ('fc@t.test', 'FC', 'h');

create temp table ids (k text primary key, id uuid);
grant all on ids to public;

do $$
declare ra record; rb record; rc record;
begin
  select * into ra from register_organization('Org A', 'Club A', (select id from accounts where email = 'fa@t.test'), 'plus', 'monthly', 'swimming');
  select * into rb from register_organization('Org B', 'Club B', (select id from accounts where email = 'fb@t.test'), 'plus', 'yearly', 'swimming');
  select * into rc from register_organization('Org C', 'Club C', (select id from accounts where email = 'fc@t.test'), 'plus', 'yearly', 'swimming');
  insert into ids values ('a', ra.organization_id), ('b', rb.organization_id), ('c', rc.organization_id);
end $$;

create function pg_temp.paid(p_org text, p_period text, p_users int, p_months numeric, p_amount numeric, p_start date, p_end date, p_kind text default 'renewal', p_added int default null, p_type text default null)
returns uuid language plpgsql as $f$
declare v uuid;
begin
  insert into subscription_renewals (organization_id, plan_code, billing_period, users, unit_price, months, amount, status, provider, provider_ref,
    period_start, period_end, requested_at, paid_at, kind, seats_added, payment_type)
  values ((select id from ids where k = p_org), 'plus', p_period, p_users, 75000, p_months, p_amount, 'paid', 'midtrans', gen_random_uuid()::text,
    p_start, p_end, (p_start::timestamp at time zone 'Asia/Jakarta'), (p_start::timestamp at time zone 'Asia/Jakarta') + interval '9 hours', p_kind, p_added, p_type)
  returning id into v;
  return v;
end $f$;

do $$
declare v_a uuid; v_b uuid; v_s uuid; m jsonb; p jsonb;
begin
  v_a := pg_temp.paid('a', 'monthly', 2, 1, 150000, '2030-11-01', '2030-12-01', 'renewal', null, 'qris');
  v_b := pg_temp.paid('b', 'yearly', 1, 10, 750000, '2030-11-01', '2031-11-01', 'renewal', null, 'bank_transfer');
  insert into ids values ('ra', v_a), ('rb', v_b);

  m := platform_metrics('2030-11-01');
  assert (m ->> 'mrr')::numeric = 212500, 'Nov MRR ' || (m ->> 'mrr');
  assert (m ->> 'arr')::numeric = 2550000, 'Nov ARR';
  assert (m ->> 'cash_paid')::numeric = 900000, 'Nov cash ' || (m ->> 'cash_paid');
  assert (m ->> 'recognized')::numeric = 212500, 'Nov recognized ' || (m ->> 'recognized');
  assert (m ->> 'deferred')::numeric = 687500, 'Nov deferred ' || (m ->> 'deferred');
  assert (m #>> '{movement,new,orgs}')::int = 2 and (m #>> '{movement,new,amount}')::numeric = 212500, 'Nov new movement';
  assert (m ->> 'paying_orgs')::int = 2, 'paying orgs';
  assert (m ->> 'arpa')::numeric = 106250, 'ARPA';

  update subscription_renewals set gateway_fee_actual = 5250 where id = v_b;
  insert into platform_expenses (month, category, vendor, amount_idr) values
    ('2030-11-01', 'infrastruktur', 'Vercel', 330000), ('2030-11-01', 'infrastruktur', 'Supabase', 412000),
    ('2030-11-01', 'alat', 'Claude', 330000), ('2030-11-01', 'lainnya', 'Domain', 345000);
  p := platform_pnl('2030-11-01');
  assert (p ->> 'gateway_fees')::numeric = 6300, 'gateway fees ' || (p ->> 'gateway_fees');
  assert (p ->> 'gateway_estimated')::int = 1, 'one estimated fee';
  assert (p ->> 'expenses')::numeric = 1417000, 'expenses';
  assert (p ->> 'tax')::numeric = 4500, 'UMKM tax ' || (p ->> 'tax');
  assert (p ->> 'net')::numeric = -1215300, 'net ' || (p ->> 'net');
  assert not (p ->> 'pkp_warning')::boolean, 'no PKP warning';

  perform pg_temp.paid('a', 'monthly', 2, 1, 150000, '2030-12-01', '2031-01-01');
  perform pg_temp.paid('a', 'monthly', 2, 1, 150000, '2031-01-01', '2031-02-01');
  perform pg_temp.paid('a', 'monthly', 2, 1, 150000, '2031-02-01', '2031-03-01');
  v_s := pg_temp.paid('b', 'yearly', 2, 7.4794, 560959, '2031-02-01', '2031-11-01', 'seats', 1);
  insert into ids values ('rs', v_s);

  m := platform_metrics('2031-02-01');
  assert (m ->> 'mrr')::numeric = 274829, 'Feb MRR ' || (m ->> 'mrr');
  assert (m ->> 'cash_paid')::numeric = 710959, 'Feb cash';
  assert (m ->> 'recognized')::numeric = 274829, 'Feb recognized ' || (m ->> 'recognized');
  assert (m ->> 'deferred')::numeric = 998630, 'Feb deferred ' || (m ->> 'deferred');
  assert (m #>> '{movement,expansion,orgs}')::int = 1 and (m #>> '{movement,expansion,amount}')::numeric = 62329, 'Feb expansion';
  assert (select amount from platform_recognition() where renewal_id = v_s and month = '2031-10-01') = 62327, 'seat purchase rounding goes to the last month';
  assert (select sum(amount) from platform_recognition() where renewal_id = v_s) = 560959, 'seat purchase sums to its amount';

  m := platform_metrics('2031-03-01');
  assert (m #>> '{movement,churn,orgs}')::int = 1 and (m #>> '{movement,churn,amount}')::numeric = -150000, 'A churns in March';

  begin perform refund_renewal(v_b, 750001, 'terlalu besar', '2031-05-01', 'transfer', null); assert false, 'refund above amount'; exception when sqlstate 'RF002' then null; end;
end $$;

do $$
declare v_c uuid;
begin
  v_c := pg_temp.paid('c', 'yearly', 1, 10, 750000, '2032-10-24', '2033-10-24');
  assert (select amount from platform_recognition() where renewal_id = v_c and month = '2032-10-01') = 16129, 'mid-month first month';
  assert (select amount from platform_recognition() where renewal_id = v_c and month = '2032-11-01') = 62500, 'full month';
  assert (select amount from platform_recognition() where renewal_id = v_c and month = '2033-10-01') = 46371, 'mid-month last month';
  assert (select sum(amount) from platform_recognition() where renewal_id = v_c) = 750000, 'sums to amount';
end $$;

savepoint before_refund;

do $$
declare v_b uuid := (select id from ids where k = 'rb'); m jsonb; p jsonb; v_inv text; v_rcp text;
begin
  select invoice_number, receipt_number into v_inv, v_rcp from subscription_renewals where id = v_b;
  perform refund_renewal(v_b, 300000, 'Turun ke bulanan', '2031-05-01', 'transfer', null);
  m := platform_metrics('2031-05-01');
  assert (m ->> 'cash_refunds')::numeric = 300000, 'refund in May cash';
  assert (select amount from platform_recognition() where renewal_id = v_b and month = '2031-05-01') = 12500, 'May recognition after partial refund';
  assert (select amount from platform_recognition() where renewal_id = v_b and month = '2031-04-01') = 62500, 'April untouched';
  assert (select sum(amount) from platform_recognition() where renewal_id = v_b) = 450000, 'partial refund total';
  assert (m ->> 'mrr')::numeric = 12500 + 62329, 'May MRR ' || (m ->> 'mrr');
  assert (m #>> '{movement,contraction,amount}')::numeric = -50000, 'May contraction ' || (m #>> '{movement,contraction,amount}');
  p := platform_pnl('2031-05-01');
  assert (p ->> 'refunds')::numeric = 50000, 'refund line in May P&L ' || (p ->> 'refunds');
  assert (p ->> 'recognized')::numeric = 74829, 'May recognized';
  assert (select invoice_number = v_inv and receipt_number = v_rcp and amount = 750000 and status = 'paid' from subscription_renewals where id = v_b), 'invoice and receipt unchanged';
  begin perform refund_renewal(v_b, 450001, 'terlalu besar', '2031-06-01', 'transfer', null); assert false, 'second refund above remainder'; exception when sqlstate 'RF002' then null; end;
end $$;

rollback to savepoint before_refund;

do $$
declare v_b uuid := (select id from ids where k = 'rb'); m jsonb;
begin
  perform refund_renewal(v_b, 750000, 'Batal penuh', '2031-05-01', 'midtrans', null);
  assert (select amount from platform_recognition() where renewal_id = v_b and month = '2031-05-01') = -375000, 'full refund reverses earlier recognition in May';
  assert (select coalesce(sum(amount), 0) from platform_recognition() where renewal_id = v_b and month > '2031-05-01') = 0, 'nothing recognized after full refund';
  assert (select sum(amount) from platform_recognition() where renewal_id = v_b) = 0, 'full refund total zero';
  m := platform_metrics('2031-05-01');
  assert (m ->> 'mrr')::numeric = 62329, 'only the seat purchase left';
end $$;

do $$
declare v_pending uuid;
begin
  v_pending := request_renewal((select id from ids where k = 'c'), null, 'plus', 'monthly', 2);
  begin perform refund_renewal(v_pending, 1, 'belum lunas', '2031-05-01', 'transfer', null); assert false, 'pending cannot be refunded'; exception when sqlstate 'RF001' then null; end;
end $$;

set local role authenticated;
do $$
begin
  begin perform * from platform_expenses; assert false, 'expenses hidden'; exception when insufficient_privilege then null; end;
  begin perform * from platform_refunds; assert false, 'refunds hidden'; exception when insufficient_privilege then null; end;
  begin perform * from payment_fee_rates; assert false, 'rates hidden'; exception when insufficient_privilege then null; end;
  assert not has_function_privilege('authenticated', 'platform_metrics(date)', 'execute'), 'metrics not callable';
  assert not has_function_privilege('authenticated', 'refund_renewal(uuid, numeric, text, date, text, uuid)', 'execute'), 'refund not callable';
  assert not has_function_privilege('anon', 'platform_pnl(date)', 'execute'), 'pnl not callable by anon';
end $$;
reset role;

rollback;
\echo finance_phase10 OK
