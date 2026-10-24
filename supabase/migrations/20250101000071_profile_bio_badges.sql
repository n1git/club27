alter table accounts
  add column bio text check (bio is null or char_length(bio) <= 160),
  add column featured_badges uuid[] not null default '{}' check (cardinality(featured_badges) <= 3);

create function profile_extras(p_username text) returns table(bio text, badges jsonb) as $$
  select a.bio,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('id', x.id, 'code', x.code, 'name', t.name, 'description', t.description, 'earned_on', x.earned_on)
        order by array_position(a.featured_badges, x.id)
      )
      from achievements x
      join achievement_types t on t.code = x.code
      where x.account_id = a.id and x.id = any (a.featured_badges)
    ), '[]'::jsonb)
  from accounts a
  where social_allowed()
    and a.username = lower(btrim(p_username))
    and a.is_active
    and a.social_banned_at is null
    and (a.id = current_account_id() or is_friend_of(a.id));
$$ language sql stable security definer set search_path = public;

revoke execute on function profile_extras(text) from public, anon;
grant execute on function profile_extras(text) to authenticated;
