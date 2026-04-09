-- Sprint 9: Project Showcase Module
-- Creates: projects, project_contributors tables + RLS

-- ── Projects ──────────────────────────────────────────────────────────────────

create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  slug                extensions.citext not null unique,
  tagline             text null,
  description         text not null default '',
  tech_stack          text[] not null default '{}',
  category            text not null default 'other'
                      check (category in ('web', 'mobile', 'ai', 'systems', 'design', 'other')),
  status              text not null default 'active'
                      check (status in ('active', 'completed', 'archived')),
  cover_image_url     text null,
  github_url          text null,
  demo_url            text null,
  is_featured         boolean not null default false,
  started_at          date null,
  completed_at        date null,
  created_by_user_id  uuid null references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Contributors ──────────────────────────────────────────────────────────────

create table if not exists public.project_contributors (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  role        text not null default 'contributor',
  joined_at   date null,
  created_at  timestamptz not null default now(),
  unique (project_id, member_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists projects_category_status_idx
  on public.projects (category, status);

create index if not exists projects_status_created_idx
  on public.projects (status, created_at desc);

create index if not exists projects_featured_idx
  on public.projects (is_featured)
  where is_featured = true;

create index if not exists project_contributors_member_idx
  on public.project_contributors (member_id);

create index if not exists project_contributors_project_idx
  on public.project_contributors (project_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.projects enable row level security;
alter table public.project_contributors enable row level security;

-- Public can read all projects (archived included — hidden at app layer)
create policy "projects unified select"
  on public.projects for select
  using (true);

-- Operators (admin/moderator) have full write access to projects
create policy "projects operator write"
  on public.projects for all
  using (
    public.has_platform_role('admin') or public.has_platform_role('moderator')
  )
  with check (
    public.has_platform_role('admin') or public.has_platform_role('moderator')
  );

-- Public can read all contributor rows
create policy "project_contributors unified select"
  on public.project_contributors for select
  using (true);

-- Operators have full write access to contributors
create policy "project_contributors operator write"
  on public.project_contributors for all
  using (
    public.has_platform_role('admin') or public.has_platform_role('moderator')
  )
  with check (
    public.has_platform_role('admin') or public.has_platform_role('moderator')
  );
