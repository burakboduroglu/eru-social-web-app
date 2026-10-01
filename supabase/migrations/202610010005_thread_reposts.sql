-- Reposts preserve the original audience and reference its state.
create table public.thread_reposts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,thread_id)
);
create index reposts_user_created_idx on public.thread_reposts(user_id,created_at desc,thread_id desc);
create index reposts_thread_idx on public.thread_reposts(thread_id);
alter table public.thread_reposts enable row level security;
revoke all on public.thread_reposts from anon,authenticated;
grant select,insert,delete on public.thread_reposts to authenticated;
create policy "Read visible reposts" on public.thread_reposts for select to authenticated
using (exists(select 1 from public.threads t where t.id=thread_id));
create policy "Repost personal originals as self" on public.thread_reposts for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.threads t where t.id=thread_id and t.parent_id is null and t.community_id is null));
create policy "Undo own reposts" on public.thread_reposts for delete to authenticated
using (user_id=(select auth.uid()));
