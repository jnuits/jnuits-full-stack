-- Runtime verification for the two unapplied migrations.
--
-- SCRATCH-ONLY. The migrations under test contain COMMIT statements, so they
-- remain applied to the disposable scratch database after this script exits.
-- Synthetic verification fixtures run in a later transaction and are rolled
-- back.
--
-- Usage:
--   psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -v scratch_ack=DISPOSABLE_SCRATCH \
--     -v expected_database="$SCRATCH_DATABASE_NAME" \
--     -f supabase/verification/verify-unapplied-migrations.sql

\set ON_ERROR_STOP on
\timing off

-- ---------------------------------------------------------------------------
-- Guard: require an explicit disposable-target acknowledgement and an exact
-- database-name match. This is not authorization to use production.
-- ---------------------------------------------------------------------------
\if :{?scratch_ack}
\else
  do $missing_scratch_ack$
  begin
    raise exception 'Pass -v scratch_ack=DISPOSABLE_SCRATCH.';
  end;
  $missing_scratch_ack$;
\endif

\if :{?expected_database}
\else
  do $missing_expected_database$
  begin
    raise exception 'Pass -v expected_database=<current_database>.';
  end;
  $missing_expected_database$;
\endif

select :'scratch_ack' = 'DISPOSABLE_SCRATCH' as scratch_ack_matches,
       current_database() = :'expected_database' as expected_database_matches
\gset

\if :scratch_ack_matches
\else
  do $invalid_scratch_ack$
  begin
    raise exception 'Scratch acknowledgement is invalid.';
  end;
  $invalid_scratch_ack$;
\endif

\if :expected_database_matches
\else
  do $unexpected_database$
  begin
    raise exception 'Connected database does not match expected_database.';
  end;
  $unexpected_database$;
\endif

do $guard$
begin
  if current_database() ~* '(prod|production|live)' then
    raise exception 'Refusing to run verification against database %.', current_database();
  end if;
  raise notice 'Verifying disposable scratch database % as %.', current_database(), current_user;
end;
$guard$;

-- ---------------------------------------------------------------------------
-- SCOPE 1: recovery snapshot.
-- Capture the CURRENT definitions before anything replaces them. Store this
-- output with the release record; git history is otherwise the only rollback.
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== SCOPE 1: recovery snapshot (store this output) ==='
select pg_get_functiondef(oid) as publish_form_version_before
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'publish_form_version';

select pg_get_functiondef(oid) as purge_retention_job_before
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'purge_retention_job';

-- ---------------------------------------------------------------------------
-- Apply both migrations under test.
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== Applying migrations under test ==='
\i supabase/migrations/20260724140000_form_publication_and_upload_session_hardening.sql
\i supabase/migrations/20260726020000_retention_purge_boundary_enforcement.sql

-- Only synthetic fixtures are rollback-scoped. The migration definitions above
-- intentionally remain installed in this disposable scratch database.
begin;

-- ---------------------------------------------------------------------------
-- SCOPE 2: publication regression (the original 42702 failure).
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== SCOPE 2: publish_form_version ==='
do $publication$
declare
  v_actor uuid;
  v_definition uuid := '00000000-0000-4000-8000-00000000d001';
  v_first_version uuid := '00000000-0000-4000-8000-00000000a001';
  v_second_version uuid := '00000000-0000-4000-8000-00000000a002';
  v_result record;
  v_schema jsonb := '{"fields": [], "payment": {"enabled": false}}'::jsonb;
begin
  select id into v_actor from auth.users order by created_at limit 1;
  if v_actor is null then
    raise exception 'Verification needs at least one auth user to attribute actions to.';
  end if;

  insert into public.form_definitions (id, kind, slug, title, lifecycle, owner_user_id)
  values (v_definition, 'membership_application', 'verify-publication', 'Verify publication', 'draft', v_actor);

  -- An already published version must be retired by the next publication. This
  -- is one of the two sites where the unqualified column reference collided
  -- with the RETURNS TABLE output variable and raised 42702.
  insert into public.form_versions (id, form_definition_id, version_number, lifecycle, field_schema, created_by_user_id, published_at, published_by_user_id)
  values (v_first_version, v_definition, 1, 'published', v_schema, v_actor, now(), v_actor);

  update public.form_definitions
  set current_published_version_id = v_first_version, lifecycle = 'published'
  where id = v_definition;

  insert into public.form_versions (id, form_definition_id, version_number, lifecycle, field_schema, created_by_user_id)
  values (v_second_version, v_definition, 2, 'draft', v_schema, v_actor);

  -- The call that failed in production.
  select * into v_result
  from public.publish_form_version(v_definition, v_second_version, v_actor);

  if v_result.form_definition_id is distinct from v_definition
    or v_result.form_version_id is distinct from v_second_version then
    raise exception 'publish_form_version returned % / %, expected % / %.',
      v_result.form_definition_id, v_result.form_version_id, v_definition, v_second_version;
  end if;
  raise notice 'PASS: output contract returns the definition and version.';

  if (select lifecycle from public.form_versions where id = v_second_version) <> 'published' then
    raise exception 'Draft version was not published.';
  end if;
  raise notice 'PASS: draft version became published.';

  if (select lifecycle from public.form_versions where id = v_first_version) <> 'retired' then
    raise exception 'Previously published version was not retired.';
  end if;
  raise notice 'PASS: previously published version was retired (the second 42702 site).';

  if (select current_published_version_id from public.form_definitions where id = v_definition)
    is distinct from v_second_version then
    raise exception 'Definition does not point at the newly published version.';
  end if;
  raise notice 'PASS: definition points at the new version.';

  -- Republishing a non-draft version must be refused.
  begin
    perform public.publish_form_version(v_definition, v_second_version, v_actor);
    raise exception 'Publishing an already published version should have been rejected.';
  exception
    when sqlstate '22023' then
      raise notice 'PASS: non-draft publication rejected.';
  end;
end;
$publication$;

-- ---------------------------------------------------------------------------
-- SCOPE 3: retention boundary (F1). The decisive test.
--
-- Against the PRE-migration purge_retention_job this block FAILS, because that
-- version filters only on form_definition_id and redacts every submission
-- regardless of age. That failure is the regression being fixed.
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== SCOPE 3: retention purge boundary ==='
do $retention$
declare
  v_actor uuid;
  v_boundary timestamptz := now() - interval '3 years';
  v_definition uuid := '00000000-0000-4000-8000-00000000d002';
  v_job uuid := '00000000-0000-4000-8000-00000000b001';
  v_manifest jsonb;
  v_old_submission uuid := '00000000-0000-4000-8000-00000000c001';
  v_recent_submission uuid := '00000000-0000-4000-8000-00000000c002';
  v_schema jsonb := '{"fields": [], "payment": {"enabled": false}}'::jsonb;
  v_version uuid := '00000000-0000-4000-8000-00000000a003';
begin
  select id into v_actor from auth.users order by created_at limit 1;

  insert into public.form_definitions (id, kind, slug, title, lifecycle, owner_user_id)
  values (v_definition, 'membership_application', 'verify-retention', 'Verify retention', 'published', v_actor);

  insert into public.form_versions (id, form_definition_id, version_number, lifecycle, field_schema, created_by_user_id, published_at, published_by_user_id)
  values (v_version, v_definition, 1, 'published', v_schema, v_actor, now(), v_actor);

  update public.form_definitions
  set current_published_version_id = v_version
  where id = v_definition;

  -- One submission well outside the boundary, one from this week.
  insert into public.form_submissions (id, form_definition_id, form_version_id, submitter_email, answers, created_at)
  values
    (v_old_submission, v_definition, v_version, 'old@example.invalid',
     '{"full_name": "Old Person"}'::jsonb, v_boundary - interval '30 days'),
    (v_recent_submission, v_definition, v_version, 'recent@example.invalid',
     '{"full_name": "Recent Person"}'::jsonb, now() - interval '2 days');

  v_manifest := jsonb_build_object(
    'algorithm', 'HMAC-SHA256',
    'manifest', jsonb_build_object(
      'archivedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'boundary', to_char(v_boundary at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'resourceId', v_definition::text,
      'rowCount', 1,
      'schemaVersion', 2,
      'scope', 'form'
    ),
    'signature', repeat('a', 64)
  );

  insert into public.form_archive_jobs (
    id, form_definition_id, requested_by_user_id, approved_by_user_id, status,
    retention_eligible_at, archive_manifest, manifest_checksum_sha256, approved_at
  )
  values (
    v_job, v_definition, v_actor, v_actor, 'purge_approved',
    v_boundary, v_manifest, repeat('b', 64), now()
  );

  perform public.purge_retention_job('form', v_job, v_actor);

  -- The pre-boundary row must be redacted.
  if (select submitter_email from public.form_submissions where id = v_old_submission) is not null
    or (select answers from public.form_submissions where id = v_old_submission) <> '{}'::jsonb then
    raise exception 'Pre-boundary submission was not purged.';
  end if;
  raise notice 'PASS: pre-boundary submission redacted.';

  -- The recent row must survive completely. This is the assertion that fails
  -- against the pre-migration function.
  if (select submitter_email from public.form_submissions where id = v_recent_submission)
    is distinct from 'recent@example.invalid' then
    raise exception 'BOUNDARY VIOLATION: recent submission email was destroyed.';
  end if;
  if (select answers from public.form_submissions where id = v_recent_submission)
    <> '{"full_name": "Recent Person"}'::jsonb then
    raise exception 'BOUNDARY VIOLATION: recent submission answers were destroyed.';
  end if;
  raise notice 'PASS: recent submission survived the purge intact.';

  -- Aggregate rows survive; purge redacts columns, never deletes rows.
  if (select count(*) from public.form_submissions where form_definition_id = v_definition) <> 2 then
    raise exception 'Purge deleted rows instead of redacting them.';
  end if;
  raise notice 'PASS: both rows still exist (aggregate statistics preserved).';

  if not exists (
    select 1 from public.audit_events
    where entity_type = 'retention_job' and action = 'retention.source_pii_purged'
      and metadata ->> 'boundary' is not null
  ) then
    raise exception 'Purge audit record is missing its boundary.';
  end if;
  raise notice 'PASS: immutable audit record written with the boundary.';
end;
$retention$;

\echo ''
\echo '=== SCOPE 3b: purge without a verified boundary must fail closed ==='
do $unbounded$
declare
  v_actor uuid;
  v_definition uuid := '00000000-0000-4000-8000-00000000d003';
  v_job uuid := '00000000-0000-4000-8000-00000000b002';
  v_schema jsonb := '{"fields": [], "payment": {"enabled": false}}'::jsonb;
  v_version uuid := '00000000-0000-4000-8000-00000000a004';
begin
  select id into v_actor from auth.users order by created_at limit 1;

  insert into public.form_definitions (id, kind, slug, title, lifecycle, owner_user_id)
  values (v_definition, 'membership_application', 'verify-unbounded', 'Verify unbounded', 'published', v_actor);

  insert into public.form_versions (id, form_definition_id, version_number, lifecycle, field_schema, created_by_user_id, published_at, published_by_user_id)
  values (v_version, v_definition, 1, 'published', v_schema, v_actor, now(), v_actor);

  -- A legacy schemaVersion 1 manifest carries no boundary.
  insert into public.form_archive_jobs (
    id, form_definition_id, requested_by_user_id, approved_by_user_id, status,
    retention_eligible_at, archive_manifest, manifest_checksum_sha256, approved_at
  )
  values (
    v_job, v_definition, v_actor, v_actor, 'purge_approved',
    now() - interval '3 years',
    jsonb_build_object('manifest', jsonb_build_object('schemaVersion', 1)),
    repeat('c', 64), now()
  );

  begin
    perform public.purge_retention_job('form', v_job, v_actor);
    raise exception 'Purge without a boundary should have been rejected.';
  exception
    when sqlstate '22023' then
      raise notice 'PASS: purge without a verified boundary fails closed.';
  end;
end;
$unbounded$;

-- ---------------------------------------------------------------------------
-- SCOPE 4: privilege posture after apply.
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== SCOPE 4: privileges ==='
do $privileges$
declare
  v_role text;
  v_signature text;
begin
  foreach v_signature in array array[
    'public.publish_form_version(uuid, uuid, uuid)',
    'public.consume_form_upload_session(uuid, uuid, uuid, text)',
    'public.bind_membership_application_cycle()'
  ] loop
    foreach v_role in array array['anon', 'authenticated'] loop
      if has_function_privilege(v_role, v_signature, 'EXECUTE') then
        raise exception 'Role % must not hold EXECUTE on %.', v_role, v_signature;
      end if;
    end loop;
    raise notice 'PASS: % is not executable by anon or authenticated.', v_signature;
  end loop;

  for v_role in select unnest(array['anon', 'authenticated']) loop
    if has_table_privilege(v_role, 'public.form_upload_sessions', 'SELECT') then
      raise exception 'Role % must not read form_upload_sessions.', v_role;
    end if;
  end loop;
  raise notice 'PASS: form_upload_sessions is not readable by anon or authenticated.';

  -- Revoking direct EXECUTE must not disable the BEFORE INSERT trigger.
  if not exists (
    select 1 from pg_trigger
    where not tgisinternal
      and tgfoid = 'public.bind_membership_application_cycle()'::regprocedure
  ) then
    raise exception 'The membership cycle trigger is missing after the privilege change.';
  end if;
  raise notice 'PASS: membership cycle trigger still installed.';
end;
$privileges$;

\echo ''
\echo '=== VERIFICATION COMPLETE — rolling back fixtures; migrations remain in scratch ==='
rollback;
