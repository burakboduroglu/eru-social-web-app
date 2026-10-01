-- External applications are links, never submitted applications.
create function public.valid_external_https(value text) returns boolean language sql immutable as $$
 select length(value) <= 2048 and value ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' and value !~ '[[:cntrl:]]'
$$;
create function public.advance_content_version() returns trigger language plpgsql set search_path=public as $$
begin
 if new.id<>old.id or new.owner_id<>old.owner_id or new.created_at<>old.created_at then raise exception 'Immutable content identity' using errcode='23514'; end if;
 new.version:=old.version+1; new.updated_at:=now();
 return new;
end $$;
create table public.jobs(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 120 and length(title)<=120),
 company text not null check(length(trim(company)) between 1 and 120 and length(company)<=120),
 location text not null default '' check(length(location)<=120),
 description text not null check(length(trim(description)) between 1 and 20000 and length(description)<=20000),
 work_mode text not null check(work_mode in ('onsite','remote','hybrid')),
 employment_type text not null check(employment_type in ('full-time','part-time','contract','internship')),
 status text not null default 'draft' check(status in ('draft','published','closed')),
 application_url text not null check(public.valid_external_https(application_url)), deadline timestamptz,
 version integer not null default 1 check(version>0), created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index jobs_created_idx on public.jobs(created_at desc,id desc);
create index jobs_owner_idx on public.jobs(owner_id,created_at desc,id desc);
create function public.guard_job_state() returns trigger language plpgsql as $$ begin
 if old.status<>'draft' and new.status='draft' or old.status='closed' and new.status<>'closed' then raise exception 'Invalid job transition' using errcode='23514'; end if; return new;
end $$;
create trigger jobs_version before update on public.jobs for each row execute function public.advance_content_version();
create trigger jobs_state before update on public.jobs for each row execute function public.guard_job_state();
alter table public.jobs enable row level security;
revoke all on public.jobs from anon,authenticated;
grant select,insert,delete on public.jobs to authenticated;
grant update(title,company,location,description,work_mode,employment_type,status,application_url,deadline) on public.jobs to authenticated;
create policy jobs_read on public.jobs for select to authenticated using(owner_id=auth.uid() or status<>'draft');
create policy jobs_insert on public.jobs for insert to authenticated with check(owner_id=auth.uid() and status='draft' and version=1 and exists(select 1 from profiles where id=auth.uid() and onboarded));
create policy jobs_update on public.jobs for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy jobs_delete on public.jobs for delete to authenticated using(owner_id=auth.uid());
create table public.job_saves(user_id uuid not null references public.profiles(id) on delete cascade,job_id uuid not null references public.jobs(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,job_id));
alter table public.job_saves enable row level security;
revoke all on public.job_saves from anon,authenticated;
grant select,insert,delete on public.job_saves to authenticated;
create policy job_saves_read on public.job_saves for select to authenticated using(user_id=auth.uid());
create policy job_saves_insert on public.job_saves for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from jobs where id=job_id and status<>'draft'));
create policy job_saves_delete on public.job_saves for delete to authenticated using(user_id=auth.uid());
