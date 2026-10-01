-- Saved posts are private viewer state and never expose aggregate save counts.
create table public.thread_bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
create index bookmarks_user_created_idx on public.thread_bookmarks (user_id, created_at desc, thread_id desc);
alter table public.thread_bookmarks enable row level security;
revoke all on public.thread_bookmarks from anon,authenticated;
grant select, insert, delete on public.thread_bookmarks to authenticated;
create policy "Read own bookmarks" on public.thread_bookmarks for select to authenticated
using (user_id = (select auth.uid()));
create policy "Create own bookmarks" on public.thread_bookmarks for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "Remove own bookmarks" on public.thread_bookmarks for delete to authenticated
using (user_id = (select auth.uid()));
