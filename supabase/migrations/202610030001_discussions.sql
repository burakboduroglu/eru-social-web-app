-- Canonical titles belong to a community. No existing post is converted.
create function public.normalize_subject_title(value text) returns text
language sql immutable strict set search_path = '' as $$
  select trim(regexp_replace(value, '[[:space:]]+', ' ', 'g'));
$$;
revoke all on function public.normalize_subject_title(text) from public, anon;
grant execute on function public.normalize_subject_title(text) to authenticated;

create table public.discussion_subjects (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  normalized_title text generated always as (lower(public.normalize_subject_title(title))) stored,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open','locked')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_title_check check (length(public.normalize_subject_title(title)) between 3 and 120),
  constraint subjects_community_title_key unique (community_id, normalized_title)
);
create index subjects_created_idx on public.discussion_subjects(created_at desc,id desc);
create index subjects_community_created_idx on public.discussion_subjects(community_id,created_at desc,id desc);

create function public.prepare_subject_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.title := public.normalize_subject_title(new.title);
  elsif new.title is distinct from old.title or new.community_id is distinct from old.community_id or new.created_at is distinct from old.created_at then
    raise exception 'Subject identity is immutable' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger subjects_identity before insert or update on public.discussion_subjects for each row execute function public.prepare_subject_identity();
create trigger subjects_version before update on public.discussion_subjects for each row execute function public.advance_content_version();
revoke all on function public.prepare_subject_identity() from public,anon,authenticated;

create table public.discussion_entries (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.discussion_subjects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000 and length(body)<=2000),
  created_at timestamptz not null default now()
);
create index entries_subject_created_idx on public.discussion_entries(subject_id,created_at,id);

create table public.subject_follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.discussion_subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,subject_id)
);
create index subject_follows_user_idx on public.subject_follows(user_id,created_at desc,subject_id desc);
create table public.subject_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.discussion_subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,subject_id)
);
create index subject_saves_user_idx on public.subject_saves(user_id,created_at desc,subject_id desc);

alter table public.discussion_subjects enable row level security;
alter table public.discussion_entries enable row level security;
alter table public.subject_follows enable row level security;
alter table public.subject_saves enable row level security;
revoke all on public.discussion_subjects,public.discussion_entries,public.subject_follows,public.subject_saves from anon,authenticated;
grant select on public.discussion_subjects,public.discussion_entries to authenticated;
grant insert(community_id,title,created_by) on public.discussion_subjects to authenticated;
grant update(status) on public.discussion_subjects to authenticated;
grant insert(subject_id,author_id,body) on public.discussion_entries to authenticated;
grant delete on public.discussion_entries to authenticated;
grant select,insert,delete on public.subject_follows,public.subject_saves to authenticated;

create policy subjects_read on public.discussion_subjects for select to authenticated using(true);
create policy subjects_insert on public.discussion_subjects for insert to authenticated with check (
  created_by=(select auth.uid()) and status='open' and version=1
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.onboarded)
  and exists(select 1 from public.community_members m where m.community_id=discussion_subjects.community_id and m.user_id=(select auth.uid()))
);
create policy subjects_update on public.discussion_subjects for update to authenticated
using(exists(select 1 from public.communities c where c.id=community_id and c.created_by=(select auth.uid())))
with check(exists(select 1 from public.communities c where c.id=community_id and c.created_by=(select auth.uid())));

create policy entries_read on public.discussion_entries for select to authenticated using(true);
create policy entries_insert on public.discussion_entries for insert to authenticated with check (
  author_id=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.onboarded)
  and exists(select 1 from public.discussion_subjects s join public.community_members m on m.community_id=s.community_id where s.id=subject_id and s.status='open' and m.user_id=(select auth.uid()))
);
create policy entries_delete on public.discussion_entries for delete to authenticated using (
  author_id=(select auth.uid())
  or exists(select 1 from public.discussion_subjects s join public.communities c on c.id=s.community_id where s.id=subject_id and c.created_by=(select auth.uid()))
);

-- A trigger needs owner privileges to lock the subject for non-moderator writers.
-- Authority is checked explicitly; the function cannot be called by API roles.
create function public.guard_subject_entry() returns trigger
language plpgsql security definer set search_path = '' as $$
declare subject_row public.discussion_subjects;
begin
  if auth.uid() is null or new.author_id<>auth.uid() or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.onboarded) then
    raise exception 'Entry author unavailable' using errcode='42501';
  end if;
  select * into subject_row from public.discussion_subjects where id=new.subject_id for share;
  if not found or subject_row.status<>'open' then
    raise exception 'Subject is unavailable or locked' using errcode='42501';
  end if;
  perform 1 from public.community_members where community_id=subject_row.community_id and user_id=auth.uid() for key share;
  if not found then raise exception 'Community membership required' using errcode='42501'; end if;
  new.body:=trim(new.body);
  return new;
end;
$$;
revoke all on function public.guard_subject_entry() from public,anon,authenticated;
create trigger entry_guard before insert on public.discussion_entries for each row execute function public.guard_subject_entry();

create policy subject_follows_read on public.subject_follows for select to authenticated using(user_id=(select auth.uid()));
create policy subject_follows_insert on public.subject_follows for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.discussion_subjects s where s.id=subject_id));
create policy subject_follows_delete on public.subject_follows for delete to authenticated using(user_id=(select auth.uid()));
create policy subject_saves_read on public.subject_saves for select to authenticated using(user_id=(select auth.uid()));
create policy subject_saves_insert on public.subject_saves for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.discussion_subjects s where s.id=subject_id));
create policy subject_saves_delete on public.subject_saves for delete to authenticated using(user_id=(select auth.uid()));
