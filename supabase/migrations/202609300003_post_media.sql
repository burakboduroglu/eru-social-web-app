-- Personal GIF libraries with public rendering for published posts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 5242880, array['image/gif'])
on conflict (id) do nothing;
create policy "Users read their media library" on storage.objects for select to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload their own media" on storage.objects for insert to authenticated
with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own media" on storage.objects for delete to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
