-- Reposts reference the original audience; membership does not grant source access.
-- Keep the owner's reference readable for undo without exposing the source itself.
drop policy "Read visible reposts" on public.thread_reposts;
create policy "Read visible reposts or own references" on public.thread_reposts
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.threads t where t.id = thread_id)
);
drop policy "Repost personal originals as self" on public.thread_reposts;
create policy "Repost eligible originals as self" on public.thread_reposts
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.threads t
    where t.id = thread_id and t.parent_id is null
      and (
        t.community_id is null
        or exists (
          select 1 from public.community_members m
          where m.community_id = t.community_id and m.user_id = (select auth.uid())
        )
      )
  )
);
