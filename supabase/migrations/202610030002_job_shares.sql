-- References retain a tombstone after source deletion; no job metadata is copied.
alter table public.threads add column resource_kind text check(resource_kind is null or resource_kind='job');
alter table public.threads add column job_id uuid references public.jobs(id) on delete set null;
alter table public.threads add constraint threads_resource_shape check(resource_kind is not distinct from 'job' or (resource_kind is null and job_id is null));
alter table public.text_drafts add column resource_kind text check(resource_kind is null or resource_kind='job');
alter table public.text_drafts add column job_id uuid references public.jobs(id) on delete set null;
alter table public.text_drafts add constraint drafts_resource_shape check(resource_kind is not distinct from 'job' or (resource_kind is null and job_id is null));
grant update(resource_kind,job_id) on public.text_drafts to authenticated;
create index threads_job_reference_idx on public.threads(job_id) where job_id is not null;
create index drafts_job_reference_idx on public.text_drafts(job_id) where job_id is not null;

-- Invoker privileges keep job lookup under the caller's existing RLS. A DB client
-- cannot bypass this API contract by inserting an owner's private draft directly.
create function public.validate_job_reference() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare source_status text; unchanged_reference boolean:=false;
begin
  if new.resource_kind is null then
    if new.job_id is not null then raise exception 'Missing resource kind' using errcode='23514'; end if;
    return new;
  end if;
  if new.resource_kind<>'job' then raise exception 'Unsupported resource kind' using errcode='23514'; end if;
  if tg_table_name='threads' then
    if new.parent_id is not null then raise exception 'Replies cannot contain job references' using errcode='23514'; end if;
  elsif new.context='reply' then raise exception 'Reply drafts cannot contain job references' using errcode='23514'; end if;
  if tg_op='UPDATE' then unchanged_reference:=old.resource_kind='job' and old.job_id is not distinct from new.job_id; end if;
  if new.job_id is null then
    if tg_op='UPDATE' and old.resource_kind='job' and
      (old.job_id is null or not exists(select 1 from public.jobs where id=old.job_id)) then return new; end if;
    raise exception 'Missing job reference' using errcode='23514';
  end if;
  select status into source_status from public.jobs where id=new.job_id for share;
  if not found or source_status='draft' or (source_status<>'published' and not (tg_table_name='text_drafts' and unchanged_reference)) then
    raise exception 'Job must be published to attach' using errcode='23514';
  end if;
  return new;
end $$;
create trigger threads_job_reference before insert or update on public.threads for each row execute function public.validate_job_reference();
create trigger drafts_job_reference before insert or update on public.text_drafts for each row execute function public.validate_job_reference();
revoke all on function public.validate_job_reference() from public,anon,authenticated;
-- Existing authenticated post audience, onboarding/community insertion rules,
-- draft owner policies, text/media requirements and draft version trigger remain.
