# Membership lifecycle authenticated browser verification

This Windows-local smoke test uses real Next.js, Supabase Auth/Postgres and
Playwright, not a mocked page or production accounts. Run it only in a new
disposable Supabase directory. It refuses any API except loopback port 55721
and any project except `jnuits-membership-qa-20261001`. Keep production
environment files out of that directory; no hosted link is needed.

## Prepare

Prerequisites: repository dependencies, Docker, Node and Supabase CLI 2.109.1.
Choose an empty temporary directory and set `MEMBERSHIP_BROWSER_QA_WORKDIR`
to its absolute path. From the repository root:

```powershell
npx --yes supabase@2.109.1 init --workdir $env:MEMBERSHIP_BROWSER_QA_WORKDIR
```

Edit the generated `supabase/config.toml` in that temporary directory:

- Top-level `project_id = "jnuits-membership-qa-20261001"`.
- `[api] port = 55721` and `[db] port = 55722`.
- Retain Postgres 17 and the CLI's default explicit-grant exposure policy.

Copy every repository migration into the temporary project's
`supabase/migrations` folder. Also copy
`supabase/verification/baseline/20260608092959_restore_rls_auto_enable.sql`
there: this verification-only helper reconstructs the historical bootstrap,
and is **not** a production migration. Do not copy production seed data.

```powershell
npx --yes supabase@2.109.1 start --exclude edge-runtime,imgproxy,logflare,mailpit,postgres-meta,realtime,storage-api,studio,supavisor,vector --yes --workdir $env:MEMBERSHIP_BROWSER_QA_WORKDIR
node supabase/verification/run-membership-browser-qa.mjs
```

Ports 55721/55722 and 3119 must be free. The script starts and stops its own
loopback Next.js server. Eight synthetic `@local.invalid` identities use
random passwords held only in memory. Local keys are obtained from CLI
status without being printed. No invitation or production email is sent.

CLI 2.109.1's fresh API-exposure defaults differ from this project's legacy
hosted table grants. The harness adds only the existing server-role SELECT
permissions needed by the loader; it does not widen anon/authenticated
table privileges. New lifecycle RPC privileges remain those in migrations.

## Assertions and limits

- Eight lifecycle/security states × two themes × four widths = 64 checks.
- Former users cannot open profile editing, mutate workplace requests, or
  directly confirm a renewal. Missing-origin mutations also fail CSRF.
- Departure and withdrawal use the real browser server actions and verify
  resulting database state.
- Frozen users reach a restricted-access explanation without redirect loops.
- No horizontal overflow or browser runtime error; a synthetic screenshot is
  saved in the temporary project directory.

`AUTH_CAPTCHA_REQUIRED=true` stays enabled. Preauthenticated synthetic
sessions intentionally bypass interactive login; this is not a CAPTCHA,
email-delivery, payment, hosted deployment, or admin-MFA browser test. SQL
replay and action tests separately cover privileged operator transitions.

## Cleanup

Stop **only this disposable project** after verification:

```powershell
npx --yes supabase@2.109.1 stop --no-backup --workdir $env:MEMBERSHIP_BROWSER_QA_WORKDIR
```

This removes its synthetic database/container state, not a production
database or other running Supabase project. Do not use a blanket Docker
cleanup. The temporary files can be removed after saving relevant evidence.
