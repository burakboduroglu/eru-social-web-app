-- Apply to a new Supabase project. Existing MongoDB/Clerk data is not imported.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  name text not null default '' check (length(name) <= 30),
  bio text not null default '' check (length(bio) <= 1000),
  image text not null default '',
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  check (not onboarded or (username is not null and length(trim(name)) >= 3))
);
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  name text not null check (length(trim(name)) between 3 and 60),
  bio text not null default '' check (length(bio) <= 350),
  image text not null default '',
  created_by uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);
create table public.community_members (
  community_id uuid references public.communities on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  primary key (community_id, user_id)
);
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(trim(text)) between 1 and 550),
  author_id uuid not null references public.profiles on delete cascade,
  community_id uuid references public.communities on delete cascade,
  parent_id uuid references public.threads on delete cascade,
  created_at timestamptz not null default now()
);
create table public.thread_likes (
  thread_id uuid references public.threads on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  primary key (thread_id, user_id)
);
create index threads_author_idx on public.threads(author_id, created_at desc);
create index threads_parent_idx on public.threads(parent_id);
create index threads_feed_idx on public.threads(created_at desc) where parent_id is null;
create index threads_community_idx on public.threads(community_id);
create index members_user_idx on public.community_members(user_id);
create index likes_user_idx on public.thread_likes(user_id);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.add_community_owner() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.community_members(community_id, user_id) values (new.id, new.created_by);
  return new;
end;
$$;
create trigger on_community_created after insert on public.communities for each row execute function public.add_community_owner();

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.threads enable row level security;
alter table public.thread_likes enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy communities_read on public.communities for select to authenticated using (true);
create policy communities_insert on public.communities for insert to authenticated with check (created_by = (select auth.uid()));
create policy communities_update on public.communities for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy communities_delete on public.communities for delete to authenticated using (created_by = (select auth.uid()));
create policy members_read on public.community_members for select to authenticated using (true);
create policy members_join on public.community_members for insert to authenticated with check (user_id = (select auth.uid()));
create policy members_leave on public.community_members for delete to authenticated using (
  (user_id = (select auth.uid()) or exists (select 1 from public.communities c where c.id = community_id and c.created_by = (select auth.uid())))
  and not exists (select 1 from public.communities c where c.id = community_id and c.created_by = user_id)
);
create policy threads_read on public.threads for select to authenticated using (true);
create policy threads_insert on public.threads for insert to authenticated with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.onboarded)
  and (community_id is null or exists (select 1 from public.community_members m where m.community_id = threads.community_id and m.user_id = (select auth.uid())))
);
create policy threads_delete on public.threads for delete to authenticated using (author_id = (select auth.uid()));
create policy likes_read on public.thread_likes for select to authenticated using (true);
create policy likes_insert on public.thread_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy likes_delete on public.thread_likes for delete to authenticated using (user_id = (select auth.uid()));

-- Reply scope is inherited from the parent even for direct API writes.
create function public.check_reply_scope() returns trigger language plpgsql set search_path = '' as $$
declare parent_community uuid;
begin
  if new.parent_id is not null then
    select community_id into parent_community from public.threads where id = new.parent_id;
    if not found then raise exception 'Parent thread not found'; end if;
    if new.community_id is distinct from parent_community then raise exception 'Reply community mismatch'; end if;
    if length(trim(new.text)) > 350 then raise exception 'Reply exceeds 350 characters'; end if;
  end if;
  return new;
end;
$$;
create trigger validate_reply before insert on public.threads for each row execute function public.check_reply_scope();

-- Serialize concurrent toggles for the same user and thread; retain RLS.
create function public.toggle_thread_like(target_thread uuid) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare removed integer; liked boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || target_thread::text, 0));
  delete from public.thread_likes where thread_id = target_thread and user_id = auth.uid();
  get diagnostics removed = row_count;
  liked := removed = 0;
  if liked then insert into public.thread_likes(thread_id, user_id) values (target_thread, auth.uid()); end if;
  return jsonb_build_object('liked', liked, 'count', (select count(*) from public.thread_likes where thread_id = target_thread));
end;
$$;
revoke all on function public.toggle_thread_like(uuid) from public, anon;
grant execute on function public.toggle_thread_like(uuid) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.add_community_owner() from public, anon, authenticated;
revoke all on function public.check_reply_scope() from public, anon, authenticated;

-- Explicit grants avoid relying on project default privileges.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.communities to authenticated;
grant select, insert, delete on public.community_members, public.threads, public.thread_likes to authenticated;
revoke all on public.profiles, public.communities, public.community_members, public.threads, public.thread_likes from anon;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy avatars_upload on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_read on storage.objects for select to authenticated using (bucket_id = 'avatars');
