-- Canonical identity is enforced for direct SQL and concurrent API requests.
create function public.normalize_saved_query(value text) returns text language sql immutable strict set search_path = public as $$
  select trim(regexp_replace(value, '[[:space:]]+', ' ', 'g'));
$$;
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  query text not null,
  normalized_query text generated always as (lower(public.normalize_saved_query(query))) stored,
  tab text not null,
  created_at timestamptz not null default now(),
  constraint saved_searches_query_check check (length(public.normalize_saved_query(query)) between 2 and 80),
  constraint saved_searches_tab_check check (tab in ('posts','people','communities')),
  constraint saved_searches_owner_query_tab_key unique(owner_id, normalized_query, tab)
);
create function public.prepare_saved_search() returns trigger language plpgsql set search_path = public as $$
begin
  new.query := public.normalize_saved_query(new.query);
  return new;
end;
$$;
create trigger saved_searches_query before insert on public.saved_searches for each row execute function public.prepare_saved_search();
create index saved_searches_owner_created_idx on public.saved_searches(owner_id, created_at desc, id desc);
alter table public.saved_searches enable row level security;
revoke all on public.saved_searches from anon, authenticated;
grant select, insert, delete on public.saved_searches to authenticated;
create policy "Read own saved searches" on public.saved_searches for select to authenticated using (owner_id = (select auth.uid()));
create policy "Save own searches" on public.saved_searches for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Remove own saved searches" on public.saved_searches for delete to authenticated using (owner_id = (select auth.uid()));
