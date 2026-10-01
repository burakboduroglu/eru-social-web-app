-- Lists are private account curation, independent of the follow graph.
create table public.account_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_lists_name_check check (length(trim(name)) between 1 and 80 and length(name) <= 80),
  constraint account_lists_description_check check (length(description) <= 350)
);
create index lists_owner_created_idx on public.account_lists(owner_id, created_at desc, id desc);
create function public.touch_account_list() returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger account_lists_updated before update on public.account_lists for each row execute function public.touch_account_list();
alter table public.account_lists enable row level security;
revoke all on public.account_lists from anon, authenticated;
grant select, insert, delete on public.account_lists to authenticated;
grant update(name, description) on public.account_lists to authenticated;
create policy "Read own lists" on public.account_lists for select to authenticated using (owner_id = (select auth.uid()));
create policy "Create own lists" on public.account_lists for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Edit own lists" on public.account_lists for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Delete own lists" on public.account_lists for delete to authenticated using (owner_id = (select auth.uid()));

create table public.account_list_members (
  list_id uuid not null references public.account_lists(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(list_id, profile_id)
);
create index list_members_created_idx on public.account_list_members(list_id, created_at desc, profile_id desc);
create index list_members_profile_idx on public.account_list_members(profile_id);
alter table public.account_list_members enable row level security;
revoke all on public.account_list_members from anon, authenticated;
grant select, insert, delete on public.account_list_members to authenticated;
create policy "Read own list members" on public.account_list_members for select to authenticated
using (exists(select 1 from public.account_lists l where l.id = list_id and l.owner_id = (select auth.uid())));
create policy "Add own list members" on public.account_list_members for insert to authenticated
with check (exists(select 1 from public.account_lists l where l.id = list_id and l.owner_id = (select auth.uid()))
  and exists(select 1 from public.profiles p where p.id = profile_id and p.onboarded));
create policy "Remove own list members" on public.account_list_members for delete to authenticated
using (exists(select 1 from public.account_lists l where l.id = list_id and l.owner_id = (select auth.uid())));
