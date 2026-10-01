create table public.account_preferences(
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 reduced_motion boolean not null default false,
 default_feed text not null default 'all' check(default_feed in ('all','latest','following','communities')),
 notification_kind text not null default 'all' check(notification_kind in ('all','reply','like','follow'))
);
alter table public.account_preferences enable row level security;
revoke all on public.account_preferences from anon,authenticated;
grant select,insert on public.account_preferences to authenticated;
grant update(reduced_motion,default_feed,notification_kind) on public.account_preferences to authenticated;
create policy preferences_read on public.account_preferences for select to authenticated using(owner_id=auth.uid());
create policy preferences_insert on public.account_preferences for insert to authenticated with check(owner_id=auth.uid());
create policy preferences_update on public.account_preferences for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
