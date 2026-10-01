create table public.articles(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 120 and length(title)<=120),
 summary text not null default '' check(length(summary)<=350),body text not null check(length(trim(body)) between 1 and 50000 and length(body)<=50000),
 status text not null default 'draft' check(status in ('draft','published')),version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index articles_created_idx on public.articles(created_at desc,id desc);
create index articles_owner_idx on public.articles(owner_id,created_at desc,id desc);
create trigger articles_version before update on public.articles for each row execute function public.advance_content_version();
create function public.guard_article_state() returns trigger language plpgsql as $$ begin
 if old.status='published' and new.status<>'published' then raise exception 'Published article remains published' using errcode='23514'; end if;return new;
end $$;
create trigger articles_state before update on public.articles for each row execute function public.guard_article_state();
alter table public.articles enable row level security;
revoke all on public.articles from anon,authenticated;
grant select,insert,delete on public.articles to authenticated;
grant update(title,summary,body,status) on public.articles to authenticated;
create policy articles_read on public.articles for select to authenticated using(owner_id=auth.uid() or status='published');
create policy articles_insert on public.articles for insert to authenticated with check(owner_id=auth.uid() and status='draft' and version=1 and exists(select 1 from profiles where id=auth.uid() and onboarded));
create policy articles_update on public.articles for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy articles_delete on public.articles for delete to authenticated using(owner_id=auth.uid());
