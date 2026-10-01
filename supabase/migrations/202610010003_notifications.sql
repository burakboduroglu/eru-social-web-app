-- New source activity creates durable private notifications; no historical backfill.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('reply','like','follow')),
  thread_id uuid references public.threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_target_check check ((kind = 'follow') = (thread_id is null)),
  constraint notifications_no_self check (recipient_id <> actor_id)
);
create index notifications_recipient_created_idx on public.notifications(recipient_id,created_at desc,id desc);
create index notifications_unread_idx on public.notifications(recipient_id) where read_at is null;
create unique index notifications_thread_source_idx on public.notifications(kind,actor_id,thread_id) where thread_id is not null;
create unique index notifications_follow_source_idx on public.notifications(recipient_id,actor_id) where kind='follow';
alter table public.notifications enable row level security;
-- Override project default privileges before granting only the safe columns.
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy "Read own notifications" on public.notifications for select to authenticated
using (recipient_id = (select auth.uid()));
create policy "Mark own notifications read" on public.notifications for update to authenticated
using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

create function public.record_reply_notification() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare recipient uuid;
begin
  if new.parent_id is not null then
    select author_id into recipient from public.threads where id=new.parent_id;
    if recipient <> new.author_id then
      insert into public.notifications(recipient_id,actor_id,kind,thread_id)
      values(recipient,new.author_id,'reply',new.id) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;
create trigger thread_reply_notification after insert on public.threads
for each row execute function public.record_reply_notification();

create function public.record_like_notification() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare recipient uuid;
begin
  if tg_op='DELETE' then
    delete from public.notifications where kind='like' and actor_id=old.user_id and thread_id=old.thread_id;
    return old;
  end if;
  select author_id into recipient from public.threads where id=new.thread_id;
  if recipient <> new.user_id then
    insert into public.notifications(recipient_id,actor_id,kind,thread_id)
    values(recipient,new.user_id,'like',new.thread_id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger thread_like_notification after insert or delete on public.thread_likes
for each row execute function public.record_like_notification();

create function public.record_follow_notification() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then
    delete from public.notifications where kind='follow' and actor_id=old.follower_id and recipient_id=old.followed_id;
    return old;
  end if;
  insert into public.notifications(recipient_id,actor_id,kind)
  values(new.followed_id,new.follower_id,'follow') on conflict do nothing;
  return new;
end;
$$;
create trigger profile_follow_notification after insert or delete on public.profile_follows
for each row execute function public.record_follow_notification();
revoke all on function public.record_reply_notification(), public.record_like_notification(), public.record_follow_notification() from public,anon,authenticated;
