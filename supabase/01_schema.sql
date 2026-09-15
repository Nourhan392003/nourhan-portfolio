-- ============================================================
-- nourhan-portfolio · 01_schema.sql
-- Brand-new Supabase project ONLY. Run in: SQL Editor.
-- Creates: projects table, profiles + admin flag, helpers.
-- No data is inserted by this file.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Projects
-- ------------------------------------------------------------
create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  slug               text not null unique,
  short_description  text not null,
  full_description   text,
  industry           text,
  project_type       text,
  technologies       text[] not null default '{}',
  cover_image_url    text,
  gallery_image_urls text[] not null default '{}',
  live_url           text,
  github_url         text,
  featured           boolean not null default false,
  published          boolean not null default false,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.projects is
  'Portfolio projects. Public sees rows where published = true (enforced by RLS).';

-- keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. Profiles (admin flag lives here)
-- ------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. is_admin = true grants write access to projects (via RLS).';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 3. Admin check helper
--    SECURITY DEFINER so policies on projects can read profiles
--    without recursive policy evaluation.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer
set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
