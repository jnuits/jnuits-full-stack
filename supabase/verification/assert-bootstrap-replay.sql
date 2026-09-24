-- Supported clean migration replay assertions (issue #18).
--
-- Runs against a DISPOSABLE scratch database created by
-- supabase/verification/run-bootstrap-replay.sh. Every failure aborts the run
-- under ON_ERROR_STOP=1, so any non-zero exit means the replay is not proven.
--
-- Two tiers, deliberately:
--
--   ENFORCED  - replay completeness, the bootstrap dependency, non-empty
--               object inventories, and SECURITY DEFINER search_path pinning.
--               None of these can produce a false failure.
--   EVIDENCE  - installed extensions, anon and authenticated write grants,
--               and the applied version range. Raised as notices rather than
--               exceptions while the historical grant posture is unresolved.
--
-- What the Linux replay on 2026-07-27 established:
--
--   96 migrations applied (95 repository migrations plus the bootstrap helper)
--   68 tables, 2 views, 66 functions, 142 policies, 51 triggers,
--   413 constraints, 8 extensions
--   34 of 34 SECURITY DEFINER functions pin search_path  -> now ENFORCED 4
--   1 table without RLS, membership_id_sequences         -> fixed by the
--                                                           20260825000000 migration
--   anon and authenticated hold TRUNCATE by default ACL  -> issue #75
--
-- No connection string, project ref, key, or PII is emitted anywhere below.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Guard 0: refuse to run anywhere that is not the disposable scratch stack.
--
-- The bootstrap helper version 20260608092959 exists ONLY in
-- supabase/verification/baseline and is never applied to production. If it is
-- absent from migration history, this is not a harness database and we abort
-- before touching anything.
-- ---------------------------------------------------------------------------
do $guard$
begin
  if current_database() <> 'postgres' then
    raise exception
      'Refusing to run: expected the disposable scratch database, found %.',
      current_database();
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260608092959'
  ) then
    raise exception
      'Refusing to run: the verification-only bootstrap helper is absent, so this is not a disposable replay database.';
  end if;

  if not exists (
    select 1 from pg_class
    where relname = '_jnuits_replay_expectations'
      and relnamespace = 'public'::regnamespace
  ) then
    raise exception
      'Refusing to run: expectation table is missing. Invoke through run-bootstrap-replay.sh.';
  end if;

  raise notice 'Guard passed: disposable replay database confirmed.';
end
$guard$;

-- ---------------------------------------------------------------------------
-- ENFORCED 1: every migration file that was copied in is recorded as applied.
--
-- This is the assertion that actually proves a clean replay. A migration that
-- silently failed to apply, or one that was reordered out of the chain, shows
-- up here.
-- ---------------------------------------------------------------------------
do $replay$
declare
  missing text;
  unexpected text;
  expected_count integer;
  applied_count integer;
begin
  select string_agg(e.version, ', ' order by e.version)
    into missing
  from public._jnuits_replay_expectations e
  where not exists (
    select 1 from supabase_migrations.schema_migrations m
    where m.version = e.version
  );

  if missing is not null then
    raise exception 'Clean replay incomplete. Missing from migration history: %', missing;
  end if;

  select string_agg(m.version, ', ' order by m.version)
    into unexpected
  from supabase_migrations.schema_migrations m
  where not exists (
    select 1 from public._jnuits_replay_expectations e
    where e.version = m.version
  );

  if unexpected is not null then
    raise exception 'Migration history contains versions that were never copied in: %', unexpected;
  end if;

  select count(*) into expected_count from public._jnuits_replay_expectations;
  select count(*) into applied_count from supabase_migrations.schema_migrations;

  if expected_count <> applied_count then
    raise exception 'Migration count mismatch: expected %, applied %.',
      expected_count, applied_count;
  end if;

  raise notice 'ENFORCED 1 passed: % migrations replayed and recorded.', applied_count;
end
$replay$;

-- ---------------------------------------------------------------------------
-- ENFORCED 2: the historical bootstrap dependency exists.
--
-- 20260608093000_admin_permission_policy_hardening.sql calls
-- public.rls_auto_enable(). No migration in the chain creates it. If this
-- assertion ever fails, the bootstrap helper has drifted and the documented
-- recovery path is broken.
-- ---------------------------------------------------------------------------
do $bootstrap$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'rls_auto_enable'
      and pronamespace = 'public'::regnamespace
  ) then
    raise exception
      'public.rls_auto_enable() is absent after replay. The bootstrap baseline no longer satisfies the historical chain.';
  end if;

  raise notice 'ENFORCED 2 passed: bootstrap dependency public.rls_auto_enable() present.';
end
$bootstrap$;

-- ---------------------------------------------------------------------------
-- ENFORCED 3: the replay actually built a schema.
--
-- Guards against the failure mode where the stack boots, records migrations,
-- and produces an essentially empty database that then passes every other
-- check vacuously.
-- ---------------------------------------------------------------------------
do $inventory$
declare
  table_count integer;
  function_count integer;
  policy_count integer;
  trigger_count integer;
  view_count integer;
  constraint_count integer;
  extension_count integer;
begin
  select count(*) into table_count
  from pg_class
  where relnamespace = 'public'::regnamespace
    and relkind = 'r'
    and relname not like '\_jnuits\_%';

  select count(*) into function_count
  from pg_proc where pronamespace = 'public'::regnamespace;

  select count(*) into policy_count
  from pg_policies where schemaname = 'public';

  select count(*) into trigger_count
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where c.relnamespace = 'public'::regnamespace
    and not t.tgisinternal;

  select count(*) into view_count
  from pg_class
  where relnamespace = 'public'::regnamespace
    and relkind in ('v', 'm');

  select count(*) into constraint_count
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  where r.relnamespace = 'public'::regnamespace;

  select count(*) into extension_count from pg_extension;

  if table_count = 0 then
    raise exception 'Replay produced no tables in public.';
  end if;
  if function_count = 0 then
    raise exception 'Replay produced no functions in public.';
  end if;
  if policy_count = 0 then
    raise exception 'Replay produced no RLS policies in public.';
  end if;
  if trigger_count = 0 then
    raise exception 'Replay produced no user triggers in public.';
  end if;
  if constraint_count = 0 then
    raise exception 'Replay produced no constraints in public.';
  end if;

  raise notice 'ENFORCED 3 passed. tables=% views=% functions=% policies=% triggers=% constraints=% extensions=%',
    table_count, view_count, function_count, policy_count,
    trigger_count, constraint_count, extension_count;
end
$inventory$;

-- ---------------------------------------------------------------------------
-- ENFORCED 4: every SECURITY DEFINER function in public pins search_path.
--
-- Promoted from EVIDENCE on 2026-07-27. The Linux replay found 34 definer
-- functions and zero offenders, so the allowlist is empty, and an empty
-- allowlist is the right moment to lock a security invariant.
--
-- A SECURITY DEFINER function that does not pin search_path executes
-- privileged code against whatever schema resolution the caller supplies. An
-- attacker who can create an object in an earlier schema on the search path
-- can have the privileged function call theirs instead. There is no benign
-- reason to omit the pin, so there is deliberately no allowlist mechanism
-- here: a new exemption is a design discussion, not a config line.
--
-- Cross-check new definer functions against
-- docs/operations/security-definer-function-register.md.
-- ---------------------------------------------------------------------------
do $definer$
declare
  offenders text;
  definer_count integer;
begin
  select count(*) into definer_count
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and prosecdef;

  select string_agg(proname, ', ' order by proname) into offenders
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and prosecdef
    and (
      proconfig is null
      or not exists (
        select 1 from unnest(proconfig) as config
        where config like 'search\_path=%'
      )
    );

  if offenders is not null then
    raise exception
      'ENFORCED 4 failed. SECURITY DEFINER functions in public that do not pin search_path: %. Add `set search_path = ''''` to each, or justify the exemption in review.',
      offenders;
  end if;

  raise notice 'ENFORCED 4 passed: all % SECURITY DEFINER functions in public pin search_path.',
    definer_count;
end
$definer$;

-- ---------------------------------------------------------------------------
-- ENFORCED 5: application-specific hardening migrations deliver their stated
-- guarantees. These are catalog checks rather than comments or NOTICE-only
-- data guards: a migration recorded as applied must leave every invariant in
-- place or the disposable replay fails.
-- ---------------------------------------------------------------------------
do $phase2_security$
declare
  invitation_using text;
  invitation_check text;
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.membership_id_sequences'::regclass
      and relrowsecurity
  ) then
    raise exception 'ENFORCED 5 failed: membership_id_sequences RLS is disabled.';
  end if;

  if has_table_privilege('anon', 'public.membership_id_sequences', 'SELECT')
     or has_table_privilege('anon', 'public.membership_id_sequences', 'INSERT')
     or has_table_privilege('anon', 'public.membership_id_sequences', 'UPDATE')
     or has_table_privilege('anon', 'public.membership_id_sequences', 'DELETE')
     or has_table_privilege('authenticated', 'public.membership_id_sequences', 'SELECT')
     or has_table_privilege('authenticated', 'public.membership_id_sequences', 'INSERT')
     or has_table_privilege('authenticated', 'public.membership_id_sequences', 'UPDATE')
     or has_table_privilege('authenticated', 'public.membership_id_sequences', 'DELETE') then
    raise exception 'ENFORCED 5 failed: browser roles retain membership_id_sequences privileges.';
  end if;

  select qual, with_check into invitation_using, invitation_check
  from pg_policies
  where schemaname = 'public'
    and tablename = 'admin_invitations'
    and policyname = 'admin invitations admin update';

  if invitation_using is null
     or invitation_check is null
     or invitation_using not ilike '%invited_role_code%content_admin%'
     or invitation_check not ilike '%invited_role_code%content_admin%'
     or invitation_using ilike '%target_user_id%'
     or invitation_check ilike '%target_user_id%' then
    raise exception 'ENFORCED 5 failed: delegated admin invitation updates are not restricted to content_admin.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'operator_reports'
      and cmd = 'INSERT'
  ) then
    raise exception 'ENFORCED 5 failed: operator_reports still has a browser INSERT policy.';
  end if;

  if has_function_privilege('anon', 'public.current_admin_role()', 'EXECUTE')
     or has_function_privilege('anon', 'public.current_portal_role()', 'EXECUTE')
     or has_function_privilege('anon', 'public.is_aal2()', 'EXECUTE') then
    raise exception 'ENFORCED 5 failed: anon can execute an RBAC helper.';
  end if;

  raise notice 'ENFORCED 5 security policies passed.';
end
$phase2_security$;

do $phase2_integrity$
declare
  event_delete "char";
  post_delete "char";
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'members_student_id_active_unique'
      and indexdef ilike 'create unique index%lower(student_id)%'
  ) then
    raise exception 'ENFORCED 5 failed: active member student-id uniqueness is absent.';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'admin_invitations_one_pending_per_email'
      and indexdef ilike 'create unique index%lower%email%'
  ) then
    raise exception 'ENFORCED 5 failed: pending invitation email uniqueness is not case-insensitive.';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'profile_update_requests_one_pending_per_type'
      and indexdef ilike 'create unique index%member_id%request_type%'
      and indexdef ilike '%status%pending%'
  ) then
    raise exception 'ENFORCED 5 failed: pending profile request uniqueness is absent.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.alumni_onboarding_cases'::regclass
      and conname = 'alumni_onboarding_cases_jnuits_id_format'
      and contype = 'c'
      and convalidated
  ) then
    raise exception 'ENFORCED 5 failed: validated alumni JnUITS-ID CHECK is absent.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_registrations'::regclass
      and conname = 'event_registrations_cancellation_consistent'
      and contype = 'c'
      and convalidated
  ) then
    raise exception 'ENFORCED 5 failed: cancellation status/timestamp CHECK is absent.';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.event_registrations'::regclass
      and tgname = 'event_registrations_cancellation_sync'
      and not tgisinternal
      and (tgtype & 4) = 4
      and (tgtype & 16) = 16
  ) then
    raise exception 'ENFORCED 5 failed: cancellation sync does not cover INSERT and UPDATE.';
  end if;

  select c.confdeltype into event_delete
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.conrelid = 'public.event_registrations'::regclass
    and c.confrelid = 'public.events'::regclass
    and c.contype = 'f'
    and a.attname = 'event_id'
  limit 1;

  select c.confdeltype into post_delete
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.conrelid = 'public.event_registrations'::regclass
    and c.confrelid = 'public.content_posts'::regclass
    and c.contype = 'f'
    and a.attname = 'event_post_id'
  limit 1;

  if event_delete is distinct from 'r' then
    raise exception 'ENFORCED 5 failed: event registration event FK is not RESTRICT.';
  end if;
  if post_delete is distinct from 'n' then
    raise exception 'ENFORCED 5 failed: event-post FK is not SET NULL.';
  end if;

  raise notice 'ENFORCED 5 integrity constraints passed.';
end
$phase2_integrity$;

do $directory_facets$
begin
  if to_regprocedure(
    'public.get_member_directory_facets(boolean,text,text,text,text)'
  ) is null then
    raise exception 'ENFORCED 5 failed: member-directory facet RPC is absent.';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_member_directory_facets(boolean,text,text,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.get_member_directory_facets(boolean,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'ENFORCED 5 failed: browser roles can execute the service-only directory facet RPC.';
  end if;

  raise notice 'ENFORCED 5 directory facet RPC passed.';
end
$directory_facets$;

-- ---------------------------------------------------------------------------
-- ENFORCED 7: committee onboarding foundation.
-- ---------------------------------------------------------------------------
do $committee_onboarding_shape$
declare
  permission_function text;
begin
  if to_regclass('public.committee_term_positions') is null then
    raise exception 'ENFORCED 7 failed: committee_term_positions is absent.';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.committee_term_positions'::regclass
  ) then
    raise exception 'ENFORCED 7 failed: committee_term_positions RLS is disabled.';
  end if;

  if exists (
    select 1
    from public.committee_assignments as assignment
    where not exists (
      select 1
      from public.committee_term_positions as position
      where position.term_id = assignment.term_id
        and position.role_id = assignment.role_id
    )
  ) then
    raise exception 'ENFORCED 7 failed: assignment lacks position backfill.';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'committee_terms_one_public_executive_number_idx'
      and indexdef ilike 'create unique index%term_number%where%is_public%'
  ) then
    raise exception 'ENFORCED 7 failed: public term-number uniqueness is absent.';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'committee_assignments_linked_appointment_unique_idx'
      and indexdef ilike 'create unique index%term_id%role_id%member_id%'
  ) then
    raise exception 'ENFORCED 7 failed: appointment uniqueness is absent.';
  end if;

  if has_table_privilege('anon', 'public.committee_term_positions', 'SELECT')
     or has_table_privilege('anon', 'public.committee_term_positions', 'INSERT')
     or has_table_privilege('anon', 'public.committee_term_positions', 'UPDATE')
     or has_table_privilege('anon', 'public.committee_term_positions', 'DELETE') then
    raise exception 'ENFORCED 7 failed: anon can access term positions.';
  end if;

  if not has_table_privilege(
    'authenticated', 'public.committee_term_positions', 'SELECT'
  ) or not has_table_privilege(
    'authenticated', 'public.committee_term_positions', 'INSERT'
  ) or not has_table_privilege(
    'authenticated', 'public.committee_term_positions', 'UPDATE'
  ) or not has_table_privilege(
    'authenticated', 'public.committee_term_positions', 'DELETE'
  ) then
    raise exception 'ENFORCED 7 failed: authenticated grants are incomplete.';
  end if;

  if has_function_privilege(
    'anon', 'public.can_manage_bulk_operation_type(text)', 'EXECUTE'
  ) then
    raise exception 'ENFORCED 7 failed: anon can execute permission routing.';
  end if;

  select pg_get_functiondef(
    'public.can_manage_bulk_operation_type(text)'::regprocedure
  ) into permission_function;

  if (
    select prosecdef
    from pg_proc
    where oid = 'public.can_manage_bulk_operation_type(text)'::regprocedure
  ) or permission_function not ilike '%admin.committee.manage%'
     or permission_function not ilike '%admin.membership.manage%'
     or permission_function not ilike '%admin.bulk.manage%' then
    raise exception 'ENFORCED 7 failed: permission routing is incomplete.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bulk_operations'
      and policyname = 'bulk operations scoped manage'
      and coalesce(qual, '') ilike '%can_manage_bulk_operation_type%'
      and coalesce(with_check, '') ilike '%can_manage_bulk_operation_type%'
  ) then
    raise exception 'ENFORCED 7 failed: parent staging policy is not scoped.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bulk_operation_rows'
      and policyname = 'bulk operation rows scoped manage'
      and coalesce(qual, '') ilike '%can_manage_bulk_operation_type%'
      and coalesce(with_check, '') ilike '%can_manage_bulk_operation_type%'
  ) then
    raise exception 'ENFORCED 7 failed: row staging policy is not scoped.';
  end if;

  raise notice 'ENFORCED 7 committee onboarding foundation shape passed.';
end
$committee_onboarding_shape$;

do $committee_onboarding_term_uniqueness$
declare
  public_term_id constant uuid := '00000000-0000-4000-8000-000000009901';
  hidden_term_id constant uuid := '00000000-0000-4000-8000-000000009902';
begin
  insert into public.committee_terms (
    id,
    slug,
    title,
    starts_on,
    status,
    is_public,
    term_number,
    term_kind,
    is_current
  ) values (
    public_term_id,
    'replay-public-committee-999',
    'Replay Public Committee 999',
    date '2099-01-01',
    'archived',
    true,
    999,
    'executive',
    false
  );

  insert into public.committee_terms (
    id,
    slug,
    title,
    starts_on,
    status,
    is_public,
    term_number,
    term_kind,
    is_current
  ) values (
    hidden_term_id,
    'replay-hidden-committee-999',
    'Replay Hidden Committee 999',
    date '2098-01-01',
    'archived',
    false,
    999,
    'executive',
    false
  );

  raise notice 'ENFORCED 7 hidden legacy duplicate term number remains allowed.';

  begin
    insert into public.committee_terms (
      slug,
      title,
      starts_on,
      status,
      is_public,
      term_number,
      term_kind,
      is_current
    ) values (
      'replay-second-public-committee-999',
      'Replay Second Public Committee 999',
      date '2097-01-01',
      'archived',
      true,
      999,
      'executive',
      false
    );
    raise exception 'ENFORCED 7 failed: duplicate public term was accepted.';
  exception
    when unique_violation then
      raise notice 'ENFORCED 7 duplicate public term number rejected.';
  end;

  delete from public.committee_terms
  where id in (public_term_id, hidden_term_id);
end
$committee_onboarding_term_uniqueness$;

do $committee_onboarding_permissions$
declare
  actor_id uuid;
  admin_role_id uuid;
  content_admin_role_id uuid;
begin
  select id
    into actor_id
  from auth.users
  order by created_at
  limit 1;

  select id
    into admin_role_id
  from public.rbac_platform_roles
  where code = 'admin'
    and scope = 'admin';

  select id
    into content_admin_role_id
  from public.rbac_platform_roles
  where code = 'content_admin'
    and scope = 'admin';

  if actor_id is null or admin_role_id is null or content_admin_role_id is null then
    raise exception 'ENFORCED 7 failed: permission fixtures are unavailable.';
  end if;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  insert into public.rbac_user_platform_roles (user_id, role_id, scope, note)
  values (
    actor_id,
    content_admin_role_id,
    'admin',
    'committee onboarding replay content-admin fixture'
  );

  if public.can_manage_bulk_operation_type('committee_roster_import')
     or public.can_manage_bulk_operation_type('member_profile_import')
     or public.can_manage_bulk_operation_type('legacy_member_import') then
    raise exception 'ENFORCED 7 failed: content_admin can manage onboarding operations.';
  end if;
  raise notice 'ENFORCED 7 content_admin cannot manage onboarding operations.';

  delete from public.rbac_user_platform_roles
  where user_id = actor_id
    and note = 'committee onboarding replay content-admin fixture';

  insert into public.rbac_user_platform_roles (user_id, role_id, scope, note)
  values (
    actor_id,
    admin_role_id,
    'admin',
    'committee onboarding replay admin fixture'
  );

  if not public.can_manage_bulk_operation_type('committee_roster_import')
     or not public.can_manage_bulk_operation_type('member_profile_import')
     or not public.can_manage_bulk_operation_type('legacy_member_import') then
    raise exception 'ENFORCED 7 failed: admin operation routing is incomplete.';
  end if;

  delete from public.rbac_user_platform_roles
  where user_id = actor_id
    and note = 'committee onboarding replay admin fixture';
  raise notice 'ENFORCED 7 committee onboarding permission routing passed.';
end
$committee_onboarding_permissions$;

-- ---------------------------------------------------------------------------
-- EVIDENCE 1: installed extensions.
-- ---------------------------------------------------------------------------
do $extensions$
declare
  installed text;
begin
  select string_agg(extname, ', ' order by extname) into installed
  from pg_extension;

  raise notice 'EVIDENCE extensions: %', coalesce(installed, '(none)');
end
$extensions$;

-- ---------------------------------------------------------------------------
-- ENFORCED 6: every public table has RLS enabled.
--
-- The 20260825000000 migration closed the sole replay drift found on
-- 2026-07-27, so a newly introduced table without RLS is now a hard failure.
-- ---------------------------------------------------------------------------
do $rls$
declare
  offenders text;
begin
  select string_agg(relname, ', ' order by relname) into offenders
  from pg_class
  where relnamespace = 'public'::regnamespace
    and relkind = 'r'
    and relname not like '\_jnuits\_%'
    and not relrowsecurity;

  if offenders is not null then
    raise exception 'ENFORCED 6 failed: public tables without RLS: %', offenders;
  end if;

  raise notice 'ENFORCED 6 passed: every table in public has RLS enabled.';
end
$rls$;

-- ---------------------------------------------------------------------------
-- EVIDENCE 3: anon and authenticated write grants on public tables.
--
-- The public Data API must never be able to insert, update, delete, or
-- truncate. The 2026-07-27 run found TRUNCATE on 39 tables, arriving through
-- ALTER DEFAULT PRIVILEGES rather than per-table grants. Tracked as issue #75.
-- RLS does not apply to TRUNCATE, so policies provide no cover here.
--
-- Read-only production inspection on the same date found worse: both roles
-- hold DELETE, INSERT, UPDATE, and TRUNCATE across 36-38 tables, from default
-- ACLs owned by both postgres and supabase_admin. So this replay UNDERSTATES
-- production exposure. Treat its output as a floor, never a ceiling.
--
-- Still a notice, because the offender list is not empty. Promote after #75.
-- ---------------------------------------------------------------------------
do $grants$
declare
  anon_offenders text;
  authenticated_offenders text;
begin
  select string_agg(distinct table_name || ':' || privilege_type, ', ')
    into anon_offenders
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

  select string_agg(distinct table_name || ':' || privilege_type, ', ')
    into authenticated_offenders
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'authenticated'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

  if anon_offenders is null then
    raise notice 'EVIDENCE grants: anon holds no write privilege on public tables.';
  else
    raise notice 'EVIDENCE grants: anon WRITE privileges present (see issue #75): %', anon_offenders;
  end if;

  if authenticated_offenders is null then
    raise notice 'EVIDENCE grants: authenticated holds no write privilege on public tables.';
  else
    raise notice 'EVIDENCE grants: authenticated WRITE privileges present (see issue #75): %', authenticated_offenders;
  end if;
end
$grants$;

-- ---------------------------------------------------------------------------
-- EVIDENCE 4: applied migration range.
--
-- `oldest` is the first migration in the chain. It is NOT the bootstrap
-- helper, which is inserted by the harness at 20260608092959, one second
-- before the migration that depends on it.
-- ---------------------------------------------------------------------------
do $range$
declare
  oldest text;
  newest text;
  helper constant text := '20260608092959';
begin
  select min(version), max(version) into oldest, newest
  from supabase_migrations.schema_migrations;

  raise notice 'EVIDENCE history: oldest=% latest=% bootstrap_helper=%',
    oldest, newest, helper;
end
$range$;

select 'BOOTSTRAP REPLAY ASSERTIONS COMPLETE' as result;
