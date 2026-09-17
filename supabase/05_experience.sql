-- ============================================================
-- nourhan-portfolio · 05_experience.sql
-- public.experiences — the CV roles, as data.
--
-- Run in: Supabase → SQL Editor (runs as postgres, so RLS is
-- bypassed). Safe to re-run: the rows below are replaced with
-- these exact values, and any row whose role is not listed here
-- is left untouched.
--
-- Same reason as 04_skills.sql: public.experiences has RLS
-- enabled, and the publishable key the site ships cannot write
-- to it (a POST returns 401 / 42501).
--
-- start_date / end_date are plain text on purpose — the public
-- renderer prints them verbatim, and prints an "Ongoing" badge
-- when end_date is empty. "Present" is stored as a real value, so
-- no badge is shown for the current role.
-- ============================================================

begin;

-- the only row that existed was the "ui &ux" dummy; the two role
-- names are cleared as well so re-running cannot duplicate them
delete from public.experiences
where role in (
  'ui &ux',
  'Freelance Frontend Developer',
  'Frontend Developer [Independent Projects]'
);

-- sort_order is what the public section reads first, so 1 / 2 puts
-- the current role above the earlier one.
insert into public.experiences
  (role, company_or_team, description, start_date, end_date, sort_order, is_visible)
values
  (
    'Freelance Frontend Developer',
    'Self-Employed / Independent',
    'Delivered responsive e-commerce web storefronts, brand websites, and interactive client portfolios with secure payment integrations (Paymob) and headless Supabase CMS architectures.',
    'May 2025',
    'Present',
    1,
    true
  ),
  (
    'Frontend Developer [Independent Projects]',
    'E-Commerce & SaaS Solutions',
    'Architected component-driven interfaces using Next.js, React.js, TypeScript, and Tailwind CSS. Implemented secure webhook verification, dynamic inventory filtering, and bidirectional scroll-driven animations.',
    'Jan 2025',
    'May 2025',
    2,
    true
  );

commit;

-- Verify:
--   select sort_order, role, company_or_team, start_date, end_date, is_visible
--   from public.experiences order by sort_order;
