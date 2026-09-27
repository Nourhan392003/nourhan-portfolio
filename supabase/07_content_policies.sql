-- ============================================================
-- nourhan-portfolio · 07_content_policies.sql
-- Row Level Security for the CMS content tables. Run AFTER
-- 01_schema.sql / 02_policies.sql in the SQL Editor.
--
-- Model (mirrors the projects table, adapted per table):
--   · anon (website visitors): SELECT only rows flagged visible.
--     - services / skills / experiences → column is_visible = true
--     - portfolio_content → visibility lives inside the content jsonb
--       (public-content.js shows a section unless content.is_visible
--       is explicitly false), so the policy allows every row whose
--       content is not explicitly invisible — exactly the rows the
--       public site can render today, no more.
--   · admins: full access (all operations) via public.is_admin(),
--     the same SECURITY DEFINER helper 02_policies.sql uses.
-- Until this runs, these tables are governed only by whatever was
-- clicked together in the dashboard — this file makes the posture
-- explicit, reviewable, and re-runnable.
-- ============================================================

-- ------------------------------------------------------------
-- services
-- ------------------------------------------------------------
alter table public.services enable row level security;

drop policy if exists "Public reads visible services" on public.services;
create policy "Public reads visible services"
  on public.services for select
  using (is_visible = true);

drop policy if exists "Admins manage services" on public.services;
create policy "Admins manage services"
  on public.services for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- skills
-- ------------------------------------------------------------
alter table public.skills enable row level security;

drop policy if exists "Public reads visible skills" on public.skills;
create policy "Public reads visible skills"
  on public.skills for select
  using (is_visible = true);

drop policy if exists "Admins manage skills" on public.skills;
create policy "Admins manage skills"
  on public.skills for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- experiences
-- ------------------------------------------------------------
alter table public.experiences enable row level security;

drop policy if exists "Public reads visible experiences" on public.experiences;
create policy "Public reads visible experiences"
  on public.experiences for select
  using (is_visible = true);

drop policy if exists "Admins manage experiences" on public.experiences;
create policy "Admins manage experiences"
  on public.experiences for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- portfolio_content (hero, about, contact, footer, …)
-- ------------------------------------------------------------
alter table public.portfolio_content enable row level security;

drop policy if exists "Public reads visible content" on public.portfolio_content;
create policy "Public reads visible content"
  on public.portfolio_content for select
  using (
    -- CASE (not a direct ::boolean cast) so one unexpected value can
    -- never abort the whole read; unknown values fail closed per-row.
    case
      when (content ->> 'is_visible') is null then true
      when lower(content ->> 'is_visible') in ('true', 't', '1') then true
      else false
    end
  );

drop policy if exists "Admins manage content" on public.portfolio_content;
create policy "Admins manage content"
  on public.portfolio_content for all
  using (public.is_admin())
  with check (public.is_admin());

-- Verify (as anon these must return ONLY visible rows; as postgres all):
--   select title, is_visible from public.services;
--   select name, is_visible from public.skills;
--   select role, is_visible from public.experiences;
--   select section_key, content ->> 'is_visible' from public.portfolio_content;
