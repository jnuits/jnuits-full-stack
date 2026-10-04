
# Audit security release — F3/F9

Local migration: 20261004104409_audit_browser_privileges_and_role_helper.sql.
New forward SQL only. Existing table SELECT/INSERT/UPDATE/DELETE and RLS
remain in place. New postgres-owned public tables/sequences/functions require
explicit browser grants; service defaults remain. Browser administrative table
privileges are revoked; RLS-dependent helper execution remains authenticated
but target-role data is returned only to a service invoker or an authorized
admin-profile manager.

## Verification

Clean bootstrap replay includes assert-audit-security.sql: existing effective
privileges, new-table defaults, portal/editor/manager/super/service callers,
profile self-access and manager target restrictions. Test-only SELECT/UPDATE
grants for retained profile RLS roll back and never enter the migration.
Concurrent verification helpers now explicitly grant their fixture execution.
The existing schema.sql is a historical snapshot, not a migration input; the
forward migration is the release authority.

Read-only hosted pre/post evidence must capture table ACLs, all default ACLs,
role-helper definition, profile policies and the four effective non-row
privileges for both browser roles. Compare SELECT/DML before and after exactly.
Verify migration SQL receipts and assigned plugin version; reconcile local
filename without changing bytes.

## Platform-owner defaults — open until independently verified

The current hosted postgres connection cannot act for supabase_admin.
Do not grant it membership or modify platform roles to bypass that restriction.
Request Supabase's supported owner/provider procedure for these public-schema
defaults; the intended provider-owned SQL is:

```sql
alter default privileges for role supabase_admin in schema public
  revoke truncate, references, trigger, maintain on tables
  from public, anon, authenticated;
```

The provider should also confirm the supported opt-in exposure procedure for
future platform-created objects. Existing project-owned table privileges and
postgres defaults are handled by our migration. A successful project migration
does not resolve supabase_admin defaults. Query pg_default_acl after the provider
action and record the result. Current connection remains unable to perform it.

## Release status

Implementation/replay local; hosted application, required CI, deployment and
platform-owner follow-up are tracked in the ignored remediation ledger.
No destructive table operation or real account/role mutation is used for QA.

## Hosted security rollout — 2026-10-04

After required CI passed at e31e9ddb1c9ce49228a4e0a863002d91a2c143be and the single review fix pass passed, the Supabase plugin applied the reviewed SQL to fsirdkjgrcocowxqjhjg. Its assigned version is 20261004161020. The local unmerged migration was renamed from 20261004104409 with identical SHA256 9e9ef1129dd638a44ec035f6cdf7fb438eb8cfa65db0f59c12aa79b7217f489f; no SQL edit or reapplication occurred.

Postflight: 113 hosted migrations, zero unintended effective TRUNCATE/TRIGGER/REFERENCES/MAINTAIN privileges for browser roles on public base tables, RLS retained, and all 213 anonymous/authenticated/service role-relation DML combinations identical to immediate preflight. Anonymous helper execution is denied; authenticated and service execution retained with the permission/service-invoker guard. Detailed sanitized catalog receipts remain in the ignored execution ledger workspace.

The revised exact PR head must pass required CI before merge. Hosted version/name parity and the submitted SQL fingerprint are recorded separately from catalog behavior. Provider-owned supabase_admin defaults and application production deployment/acceptance remain open.