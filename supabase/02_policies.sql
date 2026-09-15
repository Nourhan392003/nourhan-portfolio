-- ============================================================
-- nourhan-portfolio · 02_policies.sql
-- Row Level Security. Run AFTER 01_schema.sql in the SQL Editor.
--
-- Model:
--   · anon (website visitors): read ONLY published projects. No writes.
--   · admin (you): full access — decided by profiles.is_admin = true.
--     profiles is read through a SECURITY DEFINER helper to avoid
--     recursive policy evaluation.
-- ============================================================

-- ------------------------------------------------------------
-- projects
-- ------------------------------------------------------------
alter table public.projects enable row level security;

-- anyone may read ONLY published rows
create policy "Public reads published projects"
  on public.projects for select
  using (published = true);

-- admins may do everything (read drafts, insert, update, delete)
create policy "Admins manage projects"
  on public.projects for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- NO update policy for profiles: rows are created by the signup
-- trigger and maintained only by you (as postgres) in the SQL editor.
-- The explicit revoke strips UPDATE from authenticated entirely, so a
-- signed-in user can NEVER set is_admin on their own row via the API.
revoke update on table public.profiles from authenticated;
