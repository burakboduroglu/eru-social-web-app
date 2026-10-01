-- Context IDs deliberately survive source deletion so users can recover their text.
create table public.text_drafts(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,
 context text not null check(context in ('personal','community','reply')),target_id uuid,
 text text not null check(length(trim(text)) between 1 and 550 and length(text)<=550 and(context<>'reply' or length(text)<=350)),
 check((context='personal')=(target_id is null)),version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index text_drafts_owner_created_idx on public.text_drafts(owner_id,created_at desc,id desc);
create trigger text_drafts_version before update on public.text_drafts for each row execute function public.advance_content_version();
alter table public.text_drafts enable row level security;
revoke all on public.text_drafts from anon,authenticated;
grant select,insert,delete on public.text_drafts to authenticated;
grant update(context,target_id,text) on public.text_drafts to authenticated;
create policy text_drafts_read on public.text_drafts for select to authenticated using(owner_id=auth.uid());
create policy text_drafts_insert on public.text_drafts for insert to authenticated with check(owner_id=auth.uid() and version=1 and exists(select 1 from profiles where id=auth.uid() and onboarded));
create policy text_drafts_update on public.text_drafts for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy text_drafts_delete on public.text_drafts for delete to authenticated using(owner_id=auth.uid());
