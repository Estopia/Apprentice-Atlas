-- Private storage for authenticated users' future avatars and uploads.
insert into storage.buckets (id, name, public)
values ('user-assets', 'user-assets', false);

create policy "User assets owners can upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-assets'
  and owner_id = (select auth.uid()::text)
);

create policy "User assets owners can read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-assets'
  and owner_id = (select auth.uid()::text)
);

create policy "User assets owners can update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-assets'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'user-assets'
  and owner_id = (select auth.uid()::text)
);

create policy "User assets owners can delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-assets'
  and owner_id = (select auth.uid()::text)
);
