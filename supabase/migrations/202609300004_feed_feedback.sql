-- Explicit private feedback for personalized recommendations.
create table public.feed_feedback (
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
alter table public.feed_feedback enable row level security;
grant select, insert, delete on public.feed_feedback to authenticated;
create policy "Read own feed feedback" on public.feed_feedback for select to authenticated
using (user_id = (select auth.uid()));
create policy "Write own feed feedback" on public.feed_feedback for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "Remove own feed feedback" on public.feed_feedback for delete to authenticated
using (user_id = (select auth.uid()));
