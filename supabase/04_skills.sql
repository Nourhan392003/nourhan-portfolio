-- ============================================================
-- nourhan-portfolio · 04_skills.sql
-- public.skills — the CV skillset, as data.
--
-- Run in: Supabase → SQL Editor (runs as postgres, so RLS is
-- bypassed). Safe to re-run: the rows below are replaced with
-- these exact values, and any row whose name is not listed here
-- is left untouched.
--
-- Why this file exists: 02_policies.sql covers only projects and
-- profiles. public.skills has RLS enabled with no policy granted
-- to anon, so the publishable key the site ships CANNOT write to
-- it (a POST returns 401 / 42501). Writing has to happen from the
-- SQL Editor (or with the service_role key, which must never be
-- placed in this repo).
--
-- icon_key must be one of the keys in js/icon-library.js — a row
-- whose icon_key is not on that allowlist is silently skipped by
-- the public hydration, on purpose: every visible row must carry a
-- real inline SVG mark.
-- ============================================================

begin;

delete from public.skills
where name in (
  'Next.js', 'React.js', 'TypeScript', 'JavaScript', 'Tailwind CSS',
  'HTML5', 'CSS3', 'Framer Motion / GSAP',
  'Supabase', 'PostgreSQL', 'Convex', 'REST APIs', 'Node.js',
  'Paymob Intention API',
  'Git & GitHub', 'Vercel', 'Figma',
  'Web Security & CSP'
);

-- sort_order is global: the public section groups rows by category
-- and shows the categories in order of their first visible row, so
-- this ordering produces Frontend → Backend → E-Commerce → Tools →
-- Security with no gaps.
insert into public.skills (name, category, icon_key, sort_order, is_visible) values
  ('Next.js',              'Frontend',   'nextjs',     1, true),
  ('React.js',             'Frontend',   'react',      2, true),
  ('TypeScript',           'Frontend',   'typescript', 3, true),
  ('JavaScript',           'Frontend',   'javascript', 4, true),
  ('Tailwind CSS',         'Frontend',   'tailwind',   5, true),
  ('HTML5',                'Frontend',   'html',       6, true),
  ('CSS3',                 'Frontend',   'css',        7, true),
  ('Framer Motion / GSAP', 'Frontend',   'framer',     8, true),
  ('Supabase',             'Backend',    'supabase',   9, true),
  ('PostgreSQL',           'Backend',    'postgres',  10, true),
  ('Convex',               'Backend',    'convex',    11, true),
  ('REST APIs',            'Backend',    'rest',      12, true),
  ('Node.js',              'Backend',    'nodejs',    13, true),
  ('Paymob Intention API', 'E-Commerce', 'paymob',    14, true),
  ('Git & GitHub',         'Tools',      'github',    15, true),
  ('Vercel',               'Tools',      'vercel',    16, true),
  ('Figma',                'Tools',      'figma',     17, true),
  ('Web Security & CSP',   'Security',   'security',  18, true);

commit;

-- Verify:
--   select sort_order, category, name, icon_key, is_visible
--   from public.skills order by sort_order;
