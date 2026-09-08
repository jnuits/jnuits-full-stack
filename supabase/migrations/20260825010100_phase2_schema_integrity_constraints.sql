-- Phase 2 schema integrity constraints (audit finding DB-010)
--
-- Closes the constraint/integrity gaps catalogued during the audit. Production
-- preflight queries must prove the data is clean before this migration runs.
-- Each DDL statement then fails atomically if that assumption changes: a
-- migration must never be recorded as applied while silently omitting one of
-- its promised guarantees.
--
-- 1. members.student_id: approval logic assumes one member per student id but
--    nothing enforced it (duplicate inserts possible under races).
-- 2. events.registration_form_version_id: FK added without a supporting index.
-- 3. event_registrations.event_id: ON DELETE SET NULL orphaned registration
--    PII when an event was deleted; now RESTRICT.
-- 4. event_registrations.event_post_id: legacy CMS cascade destroyed
--    registration history when a content post was deleted; now SET NULL
--    (column was made nullable in 20260421010000).
-- 5. alumni_onboarding_cases.jnuits_id: free text with no format CHECK.
-- 6. admin_invitations.email: no unique active-invite-per-email guard.
-- 7. event_registrations: registration_status='cancelled' and cancelled_at
--    are two representations of the same fact; unique indexes key on
--    cancelled_at only, so desync lets a "status-cancelled" row keep holding
--    its email slot. A trigger keeps both columns in lockstep going forward.

begin;

-- ── 1. one active member per student id ─────────────────────────────────────

create unique index if not exists members_student_id_active_unique
  on public.members (lower(student_id))
  where student_id is not null
    and lifecycle_status in ('current', 'alumni');

-- ── 2. index for events.registration_form_version_id FK ─────────────────────

create index if not exists events_registration_form_version_idx
  on public.events (registration_form_version_id);

-- ── 3. event_registrations.event_id: SET NULL → RESTRICT ────────────────────

do $$
declare
  v_constraint text;
  v_del_type text;
begin
  select c.conname, c.confdeltype::text into v_constraint, v_del_type
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid
   and a.attnum = any (c.conkey)
  where c.conrelid = 'public.event_registrations'::regclass
    and c.confrelid = 'public.events'::regclass
    and c.contype = 'f'
    and a.attname = 'event_id'
  limit 1;

  if v_constraint is null then
    raise exception 'event_registrations.event_id FK not found';
  elsif v_del_type <> 'r' then
    -- confdeltype 'r' = restrict, 'n' = set null
    execute format(
      'alter table public.event_registrations drop constraint %I',
      v_constraint
    );
    execute format(
      'alter table public.event_registrations add constraint %I
         foreign key (event_id) references public.events (id) on delete restrict',
      v_constraint
    );
  end if;
end;
$$;

-- ── 4. event_registrations.event_post_id: CASCADE → SET NULL ────────────────

do $$
declare
  v_constraint text;
  v_del_type text;
begin
  select c.conname, c.confdeltype::text into v_constraint, v_del_type
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid
   and a.attnum = any (c.conkey)
  where c.conrelid = 'public.event_registrations'::regclass
    and c.confrelid = 'public.content_posts'::regclass
    and c.contype = 'f'
    and a.attname = 'event_post_id'
  limit 1;

  if v_constraint is null then
    raise exception 'event_registrations.event_post_id FK not found';
  elsif v_del_type <> 'n' then
    execute format(
      'alter table public.event_registrations drop constraint %I',
      v_constraint
    );
    execute format(
      'alter table public.event_registrations add constraint %I
         foreign key (event_post_id) references public.content_posts (id)
         on delete set null',
      v_constraint
    );
  end if;
end;
$$;

-- ── 5. alumni_onboarding_cases.jnuits_id format CHECK ───────────────────────

alter table public.alumni_onboarding_cases
  drop constraint if exists alumni_onboarding_cases_jnuits_id_format;

-- Matches the app-level normalizer (src/lib/members/jnuits-id.ts): standard
-- member IDs plus the retained legacy alumni-ID shape.
alter table public.alumni_onboarding_cases
  add constraint alumni_onboarding_cases_jnuits_id_format
  check (
    jnuits_id is null
    or jnuits_id ~* '^JNUITS-[0-9]{7}$'
    or jnuits_id ~* '^JNUITS-ALUMNI-[0-9]+$'
  );

-- ── 6. at most one pending invitation per canonical email ───────────────────

create unique index if not exists admin_invitations_one_pending_per_email
  on public.admin_invitations (lower(email))
  where status = 'pending';

-- Profile submission pre-checks improve the response message, while this
-- partial unique index closes the race between two concurrent requests.
create unique index if not exists profile_update_requests_one_pending_per_type
  on public.profile_update_requests (member_id, request_type)
  where status = 'pending';

-- ── 7. registration_status ⇆ cancelled_at stay in lockstep ──────────────────

create or replace function public.sync_event_registration_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.registration_status = 'cancelled' then
    new.cancelled_at := coalesce(
      new.cancelled_at,
      case when tg_op = 'UPDATE' then old.cancelled_at else null end,
      now()
    );
  else
    new.cancelled_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists event_registrations_cancellation_sync
  on public.event_registrations;

create trigger event_registrations_cancellation_sync
  before insert or update
  on public.event_registrations
  for each row
  execute function public.sync_event_registration_cancellation();

revoke execute on function public.sync_event_registration_cancellation()
  from public, anon, authenticated;

alter table public.event_registrations
  drop constraint if exists event_registrations_cancellation_consistent;

alter table public.event_registrations
  add constraint event_registrations_cancellation_consistent
  check (
    registration_status is not null
    and (
      (registration_status = 'cancelled') = (cancelled_at is not null)
    )
  );

notify pgrst, 'reload schema';

commit;
