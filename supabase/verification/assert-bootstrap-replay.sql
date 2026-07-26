-- Supported clean migration replay assertions (issue #18).
--
-- Runs against a DISPOSABLE scratch database created by
-- supabase/verification/run-bootstrap-replay.sh. Every failure aborts the run
-- under ON_ERROR_STOP=1, so any non-zero exit means the replay is not proven.
--
-- Two tiers, deliberately:
--
--   ENFORCED  - replay completeness, the bootstrap dependency, and non-empty
--               object inventories. These cannot produce a false failure.
--   EVIDENCE  - RLS coverage, SECURITY DEFINER search_path pinning, and anon
--               write grants. These are raised as notices, not exceptions,
--               because their legitimate allowlists have never been confirmed
--               against a real replay. Promote them to ENFORCED after one
--               local run establishes the allowlist. Do not promote them by
--               guessing.
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
-- EVIDENCE 2: tables in public without RLS enabled.
--
-- Not an exception. Some tables may be intentionally public. Confirm the real
-- list locally, record the allowlist, then promote this block.
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

  if offenders is null then
    raise notice 'EVIDENCE rls: every table in public has RLS enabled.';
  else
    raise notice 'EVIDENCE rls: tables WITHOUT RLS enabled: %', offenders;
  end if;
end
$rls$;

-- ---------------------------------------------------------------------------
-- EVIDENCE 3: SECURITY DEFINER functions without a pinned search_path.
--
-- Cross-check against docs/operations/security-definer-function-register.md.
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

  raise notice 'EVIDENCE security_definer: % definer functions in public.', definer_count;

  if offenders is null then
    raise notice 'EVIDENCE security_definer: every definer function pins search_path.';
  else
    raise notice 'EVIDENCE security_definer: NOT pinning search_path: %', offenders;
  end if;
end
$definer$;

-- ---------------------------------------------------------------------------
-- EVIDENCE 4: anon write grants on public tables.
--
-- The public Data API must never be able to insert, update, or delete.
-- ---------------------------------------------------------------------------
do $grants$
declare
  offenders text;
begin
  select string_agg(distinct table_name || ':' || privilege_type, ', ')
    into offenders
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

  if offenders is null then
    raise notice 'EVIDENCE grants: anon holds no write privilege on public tables.';
  else
    raise notice 'EVIDENCE grants: anon WRITE privileges present: %', offenders;
  end if;
end
$grants$;

-- ---------------------------------------------------------------------------
-- EVIDENCE 5: applied migration versions, oldest and newest.
-- ---------------------------------------------------------------------------
do $range$
declare
  oldest text;
  newest text;
begin
  select min(version), max(version) into oldest, newest
  from supabase_migrations.schema_migrations;

  raise notice 'EVIDENCE history: bootstrap=% latest=%', oldest, newest;
end
$range$;

select 'BOOTSTRAP REPLAY ASSERTIONS COMPLETE' as result;
