# Non-payment Forms Launch — Implementation Plan

> **Execution:** sequential, test-first tasks on `codex/forms-launch`. Existing public, portal, admin, invitation, certificate, and RBAC flows must remain intact.

## Global constraints

- Payment configuration remains disabled; no provider or checkout ships.
- No starter forms or automatic publication. Staff create and publish forms in Form Studio.
- No live Supabase DDL, DML, grants, revocations, archive, or purge without explicit approval. New migrations may be authored and verified locally only.
- Cloudinary assets remain private. Never expose credentials, Supabase secret keys, or persistent public asset URLs.
- Hosted previews are read-only. Write-path validation is local plus a controlled production staff smoke after deployment approval.
- No new dependency without approval. Keep Supabase and Vercel free-tier limits in scope.

## 1. Correct event registration contract and public status

**Files:** `src/app/api/events/[eventId]/register/route.ts`, `src/app/api/events/[eventId]/register/route.linked-form.test.ts`, `src/components/forms/public-form-screen.tsx`, focused tests.

1. Add a failing route test proving atomic RPC result `confirmed` returns HTTP 200 with a registration code.
2. Make route accept the database contract (`confirmed`), preserve `duplicate`, `full`, `closed`, and `waitlisted` behavior.
3. Carry `waitlisted` and registration code to `PublicFormScreen`; show accurate confirmed versus waitlist copy.
4. Run focused tests, typecheck, and event-registration regression tests.

## 2. Enable secure event-form image and PDF submissions

**Files:** `src/app/api/forms/[slug]/uploads/sign/route.ts`, `src/app/api/events/[eventId]/register/route.ts`, `src/lib/forms/upload-proof.ts`, event/form tests, a new expand-first migration if required.

1. Add failing tests for authorized event file upload signing and server-side proof verification.
2. Remove only the event-kind prohibition from the narrow signer; retain published-form, CAPTCHA, rate-limit, MIME, size, expiry, UUID-folder, and upload-owner checks.
3. Validate each proof server-side in the event route and persist asset references atomically with the registration/submission. If schema/RPC extension is needed, author a forward-compatible migration; do not apply it without approval.
4. Never return Cloudinary permanent delivery URLs. Use authenticated/staff-only retrieval paths.
5. Run focused tests, migration static check, typecheck.

## 3. Complete Form Studio lifecycle and reviewer workspace

**Files:** `src/components/admin/form-studio-screen.tsx`, form admin API routes, `src/app/admin/**`, form tests.

1. Add failing tests for draft creation, resume/edit/save, immutable publish version, and role denial.
2. Load existing drafts, save field changes, create a new draft from a published definition, and expose no-code Image/PDF fields.
3. Add server-paginated reviewer list/detail/decision actions. Require `admin.forms.review` and update linked `form_submissions.review_status` with typed membership/alumni review records.
4. Keep staff workflow legible: Form, Open, Close, Review, Invite.
5. Run targeted tests, admin UI audit, typecheck.

## 4. Finish membership and alumni onboarding

**Files:** public form routes, membership/alumni API services and admin pages, invitation integration tests, possibly local migration.

1. Add failing tests for active annual membership-cycle gating, approval without automatic portal access, and safe alumni reconciliation.
2. Membership confirmation writes both a versioned submission and `membership_applications`; staff approval reconciles membership and issues the canonical invitation/claim flow.
3. Implement alumni review queue and approval/rejection. Deduplicate normalized email/JnUITS ID, reactivate/create safely, then issue canonical claim invitation.
4. Keep `/membership` and `/alumni-join` closed until a staff-published form and active intake exist. Provide status lookup/resubmission guidance without exposing submission data.
5. Run invitation, RBAC, and browser flow tests.

## 5. Add durable delivery, exports, and retention operations

**Files:** Resend webhook route/service, export/Google Drive service, retention job/API/admin UI, env validation, tests, migrations if needed.

1. Add failing tests for idempotent delivery ledger transitions, signed Resend webhook verification, export audit records, archive-before-purge, and AAL2 authorization.
2. Route confirmations, waitlist notices, invitations, and export notifications through the durable quota-aware ledger. Provider delivery state comes from verified webhooks, not send acceptance.
3. Produce auditable CSV/XLSX and on-demand Shared Drive snapshots with formula protection, actor/filter/version metadata, checksums, retry-safe failure records, and expiry.
4. Implement manual three-year candidate discovery, verified Drive archive manifest with immutable Cloudinary identifiers, AAL2 authorization, explicit approval, and source PII purge that retains operational aggregates/audit.
5. Keep Cloudinary originals private and outside purge until a separately approved media-deletion policy exists.
6. Run unit/integration tests and controlled Drive archive dry run when configuration is available.

## 6. Harden RBAC, observability, responsive behavior, and CI

**Files:** permissions/RLS migrations, Sentry initialization, `.github/workflows/**`, `.gitignore`, `README.md`, responsive/admin components, tests.

1. Add failing permission tests for form publishing, review, export, retention, and Google/provider configuration; verify RLS/grants with Supabase advisors before each schema change.
2. Enforce AAL2 where required. Keep form submissions inaccessible through public Data API.
3. Disable Sentry default PII/local variables, add scrubbers, separate test/production releases, and protect diagnostics.
4. Fix confirmed mobile/tablet overflow only, preserving visual language. Check public/admin/portal at 375x812, 768x1024, 1280x900, and wide desktop for all roles.
5. Ensure GitHub workflows run lint, typecheck, unit/integration, migration parity, build, browser matrix, dependency/secret scan, environment validation, release readiness, and trusted-branch pre-production tests.
6. Add only ignored local build/cache/log/coverage/env artifacts; never delete user work or rewrite shared history without approval.

## 7. Release validation and staged onboarding

**Files:** `docs/operations/release-readiness.md`, CI/runbooks, test artifacts.

1. Run standard gates: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, admin audits, browser matrix, runtime probe, migration parity, and role-aware authenticated tests.
2. Confirm production CAPTCHA configuration, Supabase leaked-password protection, Cloudinary quota/private delivery, Resend webhook, Sentry PII scrub, Google Drive archive dry run, Vercel runtime errors, and rollback controls.
3. Deploy verified build only. Controlled staff smoke uses a temporary QA form and test inbox; no previews write production data.
4. Roll out staff, 20-user pilot, then daily student cohorts. Batch sender caps dispatch at `floor(provider_daily_limit * 0.90)`, remains idempotent/resumable, and preserves 10% capacity for operations.
5. Require explicit approval before live migration, bulk send, archive, or purge.

## Completion evidence

For every task: record changed files, failing-test proof, passing targeted/broader checks, production dependencies, and residual risks. Do not mask failures or weaken assertions.
