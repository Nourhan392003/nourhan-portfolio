-- ============================================================
-- nourhan-portfolio · 03_storage.sql
-- Image storage. Run AFTER 01 + 02 in the SQL Editor.
--
-- Creates the PUBLIC bucket 'project-images' (brand-new; shares
-- nothing with any other project's buckets) and locks it down:
--   · everyone: view images
--   · admins only: upload / replace / delete
-- ============================================================

-- 1. Public-read bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do update set public = true;

-- 2. Anyone can view images
create policy "Public can view project images"
  on storage.objects for select
  using (bucket_id = 'project-images');

-- 3. Only admins can upload — confined to the nourhan-portfolio/ folder
create policy "Admins can upload project images"
  on storage.objects for insert
  with check (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = 'nourhan-portfolio'
    and public.is_admin()
  );

-- 4. Only admins can replace
create policy "Admins can update project images"
  on storage.objects for update
  using (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = 'nourhan-portfolio'
    and public.is_admin()
  );

-- 5. Only admins can delete
create policy "Admins can delete project images"
  on storage.objects for delete
  using (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = 'nourhan-portfolio'
    and public.is_admin()
  );
