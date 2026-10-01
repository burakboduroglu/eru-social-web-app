create table public.community_events(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,
 community_id uuid not null references public.communities(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 120 and length(title)<=120),
 description text not null default '' check(length(description)<=2000),starts_at timestamptz not null,ends_at timestamptz,
 check(ends_at is null or ends_at>starts_at),meeting_url text not null default '' check(meeting_url='' or public.valid_external_https(meeting_url)),
 status text not null default 'active' check(status in ('active','cancelled')),version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index events_community_created_idx on public.community_events(community_id,created_at desc,id desc);
create index events_starts_idx on public.community_events(starts_at);
create function public.guard_event_content() returns trigger language plpgsql as $$ begin
 if tg_op='INSERT' then
   if new.starts_at<=now() then raise exception 'Events start in future' using errcode='23514'; end if;
 else
   if new.community_id<>old.community_id or old.status='cancelled' and new.status<>'cancelled' then raise exception 'Invalid event transition' using errcode='23514';end if;
   if new.starts_at<>old.starts_at and new.starts_at<=now() then raise exception 'Changed starts must be in future' using errcode='23514';end if;
 end if;return new;
end $$;
create trigger events_guard before insert or update on public.community_events for each row execute function public.guard_event_content();
create trigger events_version before update on public.community_events for each row execute function public.advance_content_version();
alter table public.community_events enable row level security;
revoke all on public.community_events from anon,authenticated;
grant select,insert,delete on public.community_events to authenticated;
grant update(title,description,starts_at,ends_at,meeting_url,status) on public.community_events to authenticated;
create policy events_read on public.community_events for select to authenticated using(exists(select 1 from community_members m where m.community_id=community_events.community_id and m.user_id=auth.uid()));
create policy events_insert on public.community_events for insert to authenticated with check(owner_id=auth.uid() and status='active' and version=1 and exists(select 1 from profiles p where p.id=auth.uid() and p.onboarded) and exists(select 1 from community_members m where m.community_id=community_events.community_id and m.user_id=auth.uid()));
create policy events_update on public.community_events for update to authenticated using(owner_id=auth.uid() and exists(select 1 from community_members m where m.community_id=community_events.community_id and m.user_id=auth.uid())) with check(owner_id=auth.uid() and exists(select 1 from community_members m where m.community_id=community_events.community_id and m.user_id=auth.uid()));
create policy events_delete on public.community_events for delete to authenticated using(owner_id=auth.uid() and exists(select 1 from community_members m where m.community_id=community_events.community_id and m.user_id=auth.uid()));
create table public.event_rsvps(event_id uuid not null references public.community_events(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(event_id,user_id));
alter table public.event_rsvps enable row level security;
revoke all on public.event_rsvps from anon,authenticated;
grant select,insert,delete on public.event_rsvps to authenticated;
create policy rsvps_read on public.event_rsvps for select to authenticated using(user_id=auth.uid() and exists(select 1 from community_events e where e.id=event_id));
create policy rsvps_insert on public.event_rsvps for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from community_events e where e.id=event_id and e.status='active' and e.starts_at>now()));
create policy rsvps_delete on public.event_rsvps for delete to authenticated using(user_id=auth.uid());
-- Serialize RSVP insertion against event edits/cancellation even for direct SQL callers.
create function public.guard_event_rsvp() returns trigger language plpgsql security definer set search_path=public as $$
declare event_row public.community_events;
begin
 select * into event_row from public.community_events where id=new.event_id for share;
 if not found or new.user_id<>auth.uid() or event_row.status<>'active' or event_row.starts_at<=now() or not exists(select 1 from public.community_members m where m.community_id=event_row.community_id and m.user_id=auth.uid()) then raise exception 'Event unavailable' using errcode='42501';end if;
 return new;
end $$;
revoke execute on function public.guard_event_rsvp() from public,anon,authenticated;
create trigger event_rsvp_guard before insert on public.event_rsvps for each row execute function public.guard_event_rsvp();
