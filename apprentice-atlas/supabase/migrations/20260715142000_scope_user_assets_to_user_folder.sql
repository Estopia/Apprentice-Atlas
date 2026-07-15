-- Keep future private uploads under <auth.uid()>/ so in-app account deletion can
-- remove the underlying Storage objects before deleting the Auth user.
drop policy if exists "User assets owners can upload" on storage.objects;
drop policy if exists "User assets owners can read" on storage.objects;
drop policy if exists "User assets owners can update" on storage.objects;
drop policy if exists "User assets owners can delete" on storage.objects;

create policy "User assets owners can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'user-assets'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "User assets owners can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'user-assets'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "User assets owners can update"
on storage.objects for update to authenticated
using (
  bucket_id = 'user-assets'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'user-assets'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "User assets owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'user-assets'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
