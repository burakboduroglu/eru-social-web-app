-- Authenticated members can read the directed graph; only its source can mutate it.
create table public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint profile_follows_no_self check (follower_id <> followed_id)
);
create index follows_follower_created_idx on public.profile_follows (follower_id, created_at desc, followed_id desc);
create index follows_followed_created_idx on public.profile_follows (followed_id, created_at desc, follower_id desc);
alter table public.profile_follows enable row level security;
revoke all on public.profile_follows from anon,authenticated;
grant select, insert, delete on public.profile_follows to authenticated;
create policy "Read follow graph" on public.profile_follows for select to authenticated using (true);
create policy "Follow as self" on public.profile_follows for insert to authenticated
with check (follower_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id = followed_id and p.onboarded
));
create policy "Unfollow as self" on public.profile_follows for delete to authenticated
using (follower_id = (select auth.uid()));
