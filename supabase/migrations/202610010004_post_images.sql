-- Trusted ingestion metadata is written only by the server's privileged connection.
create table public.media_uploads (
  object_path text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_object_id uuid references storage.objects(id) on delete restrict,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  width integer not null check (width between 1 and 8192),
  height integer not null check (height between 1 and 8192),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  cleanup_pending boolean not null default false,
  check ((cleanup_pending and storage_object_id is null) or (not cleanup_pending and storage_object_id is not null)),
  created_at timestamptz not null default now(),
  check (width::bigint * height <= 40000000),
  check (split_part(object_path,'/',1) = owner_id::text)
);
create index media_uploads_owner_created_idx on public.media_uploads(owner_id,created_at);
alter table public.media_uploads enable row level security;
revoke all on public.media_uploads from public,anon,authenticated;
grant select on public.media_uploads to authenticated;
create policy "Read own validated uploads" on public.media_uploads for select to authenticated
using (owner_id = (select auth.uid()));

create table public.thread_media (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null references public.media_uploads(object_path),
  mime_type text not null,
  byte_size integer not null,
  width integer not null,
  height integer not null,
  alt_text text not null default '' check (length(alt_text) <= 1000),
  position integer not null check (position between 0 and 3),
  unique(thread_id,position)
);
create index thread_media_object_idx on public.thread_media(object_path);
alter table public.thread_media enable row level security;
revoke all on public.thread_media from public,anon,authenticated;
grant select,insert,delete on public.thread_media to authenticated;
create policy "Read visible thread images" on public.thread_media for select to authenticated
using (exists(select 1 from public.threads t where t.id=thread_id));
create policy "Attach own validated images" on public.thread_media for insert to authenticated
with check (owner_id=(select auth.uid()) and exists(select 1 from public.threads t where t.id=thread_id and t.author_id=(select auth.uid())));
create policy "Remove own image references" on public.thread_media for delete to authenticated
using (owner_id=(select auth.uid()));

create function public.validate_thread_media() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare upload public.media_uploads; author uuid;
begin
  select * into upload from public.media_uploads where object_path=new.object_path for share;
  select author_id into author from public.threads where id=new.thread_id;
  if upload.object_path is null or upload.cleanup_pending or upload.owner_id is distinct from new.owner_id or author is distinct from new.owner_id then
    raise exception 'Image ownership or validation is invalid' using errcode='23514';
  end if;
  new.mime_type := upload.mime_type; new.byte_size := upload.byte_size;
  new.width := upload.width; new.height := upload.height;
  return new;
end;
$$;
create trigger validate_image_reference before insert on public.thread_media
for each row execute function public.validate_thread_media();

alter table public.threads drop constraint threads_text_check;
alter table public.threads add constraint threads_text_check check (length(trim(text)) between 0 and 550);
create function public.check_thread_content() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid; content text;
begin
  if tg_table_name='threads' then target := new.id;
  elsif tg_op='DELETE' then target := old.thread_id;
  else target := new.thread_id;
  end if;
  select text into content from public.threads where id=target;
  if found and length(trim(content))=0 and not exists(select 1 from public.thread_media where thread_id=target) then
    raise exception 'Thread requires text or an image' using errcode='23514';
  end if;
  return null;
end;
$$;
create constraint trigger threads_require_content after insert or update on public.threads
deferrable initially deferred for each row execute function public.check_thread_content();
create constraint trigger media_require_content after insert or delete or update on public.thread_media
deferrable initially deferred for each row execute function public.check_thread_content();
revoke all on function public.validate_thread_media(),public.check_thread_content() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('post-images','post-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy "Read own staging images" on storage.objects for select to authenticated
using (bucket_id='post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Upload own staging images" on storage.objects for insert to authenticated
with check (bucket_id='post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Delete own unregistered images" on storage.objects for delete to authenticated
using (bucket_id='post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Restrictive policies protect validated paths even if a project has broad grants.
create policy "Keep registered images immutable" on storage.objects as restrictive for delete to authenticated
using (bucket_id<>'post-images' or not exists(select 1 from public.media_uploads m where m.object_path=name and (
  not m.cleanup_pending or exists(select 1 from public.thread_media r where r.object_path=m.object_path)
)));
create policy "Never replace post images" on storage.objects as restrictive for update to authenticated
using (bucket_id<>'post-images') with check (bucket_id<>'post-images');
create policy "Never overwrite registered images" on storage.objects as restrictive for insert to authenticated
with check (bucket_id<>'post-images' or not exists(select 1 from public.media_uploads m where m.object_path=name));
