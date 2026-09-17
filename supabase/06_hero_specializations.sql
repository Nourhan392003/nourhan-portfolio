-- ============================================================
-- nourhan-portfolio · 06_hero_specializations.sql
-- public.portfolio_content → the hero row's `specializations`.
--
-- Run in: Supabase → SQL Editor (runs as postgres, so RLS is
-- bypassed). Safe to re-run — it is a single targeted update.
--
-- Why this file exists: the hero line reads its rotation from
-- here, and a stored list WINS over the default shipped in
-- script.js / js/public-content.js. The row currently holds five
-- entries that include neither UI/UX Designer nor the requested
-- order, so the live site rotates the old list until this runs.
-- There is no path around that: the publishable key the site
-- ships cannot write this table (a PATCH returns 200 with an
-- empty representation, i.e. RLS filtered every row).
--
-- IMPORTANT: `jsonb_set` is used on purpose. The obvious
--   update ... set content = '{"specializations": [...]}'
-- would REPLACE the whole object and silently delete the hero's
-- other twelve fields (eyebrow, first_name, profile_image,
-- description lines, CTA labels and hrefs, availability…).
-- jsonb_set touches one key and leaves the rest alone.
--
-- Order matters: the typewriter rotates the array in order, and
-- the FIRST entry is what a visitor with prefers-reduced-motion
-- sees as static text.
-- ============================================================

begin;

update public.portfolio_content
set content = jsonb_set(
      content::jsonb,
      '{specializations}',
      '["Frontend Developer", "UI/UX Designer", "E-Commerce Specialist"]'::jsonb,
      true
    )
where section_key = 'hero';

commit;

-- Verify — this must print the three roles in this order, and the
-- second query must still list every hero field (13 keys):
--   select content -> 'specializations' from public.portfolio_content where section_key = 'hero';
--   select jsonb_object_keys(content::jsonb) from public.portfolio_content where section_key = 'hero';
