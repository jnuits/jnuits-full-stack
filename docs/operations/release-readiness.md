# Release Readiness Runbook

Use this runbook before calling the current JnUITS product scope launch-ready.

## Local Gates

Run these from the repo root:

```bash
npm run typecheck
npm run lint
npm test
npm run audit:admin-access
npm run audit:admin-ui
npm audit --audit-level=moderate
npm run build
npm run test:e2e
```

Run the full browser matrix when validating a release candidate:

```bash
npm run test:e2e:matrix
```

Local Playwright runs use a fresh build and server by default. To target a
pre-production deployment, set `PLAYWRIGHT_BASE_URL` to that deployment; the
test runner will not start or reuse a local server.
`PLAYWRIGHT_REUSE_EXISTING_SERVER=1` is only for deliberate local QA when no
build will replace `.next`.

Run the runtime probe against a production-like server:

```bash
npm run build
npm run start -- -p 3100
npm run test:runtime-probe
```

## Supabase Gates

Run migration parity with the supported CLI path:

```bash
SUPABASE_CLI_COMMAND="npx --yes supabase" npm run migration:check
```

Run the read-only cleanup audit when a Supabase access token is available:

```bash
SUPABASE_CLI_COMMAND="npx --yes supabase" npm run db:audit-cleanup
```

Live DDL/DML remains approval-gated. Do not apply migrations, run repair commands, or revoke grants without explicit live-DB approval for the task.

## Critical Smoke Routes

Public:

- `/`
- `/members`
- `/alumni`
- `/blogs`
- `/notices`
- `/events`
- `/gallery`
- `/projects`
- `/certificates?q=24007`
- `/contact`
- `/membership-form`

Portal:

- `/portal/login`
- `/portal/dashboard`
- `/portal/profile`
- `/portal/blogs`
- `/portal/projects`
- `/portal/access-pending`

Admin:

- `/admin`
- `/admin/applications`
- `/admin/invitations`
- `/admin/profile-changes`
- `/admin/membership`
- `/admin/bulk-operations`
- `/admin/content/blogs`
- `/admin/content/events`
- `/admin/content/gallery`
- `/admin/committee`
- `/admin/audit`
- `/admin/reports`
- `/admin/certificates`
- `/admin/decisions`
- `/admin/system-health`
- `/admin/admin-profiles`
- `/admin/settings/security`
- `/admin/settings/notifications`
- `/admin/settings/contact`

## Manual Role QA

Validate these roles in browser sessions:

- Super admin: full admin surface, admin account lifecycle, certificates, and system health.
- Normal admin: membership and content-authorized workflows without super-admin-only actions.
- Content admin: content-only dashboard/nav and no membership/admin lifecycle controls.
- Current member: portal dashboard, profile, workplace/profile request flows.
- Alumni member: portal dashboard, workplace update flow, public member visibility rules.

## Completion Criteria

A release is ready only when:

- all local gates pass;
- Supabase migration parity is known and documented;
- certificate production schema matches the public API shape using `full_name`;
- no critical route has a client-side runtime error;
- responsive QA passes at 375px, 768px, 1280px, and wide desktop;
- onboarding invite and member claim flows work end to end;
- unresolved legacy code/data is documented as compatibility, not accidental drift.
- docs/operations/legacy-tooling-register.md and docs/operations/admin-workflow-ownership.md have been reviewed for the release.
