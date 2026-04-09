# Implementation Tracker (Execution Plan v3)

| Phase | Status | Blocker | Owner | Prerequisites | Evidence | Exit Gate |
| --- | --- | --- | --- | --- | --- | --- |
| Phase A: Foundation corrections | Completed | None | Codex + project owner | `plan/New_Plan.md` approved | `supabase/migrations/20260409040000_super_admin_role_hierarchy.sql`, `src/lib/auth/session.ts`, `src/lib/supabase/proxy.ts`, `scripts/rehearse-cutover.mjs`, `.github/workflows/quality-gate.yml` | `npm run lint`, `npm run typecheck`, `npm run build` pass; protected redirect targets and role hierarchy fixes are applied |
| Phase B: Public parity restoration | Completed | None | Codex + content owner | Phase A complete | `src/app/(public)/blogs/[identifier]/page.tsx`, `src/app/(public)/events/[identifier]/page.tsx`, `src/app/(public)/gallery/[identifier]/page.tsx`, `src/app/(public)/committee/[termSlug]/page.tsx`, `src/app/(public)/committee/5th/page.tsx`, `src/app/(public)/committee/advisory/page.tsx`, `src/lib/content/public-content.ts`, `src/lib/committee/public.ts` | Legacy-critical detail routes and committee aliases resolve without parity-breaking 404s |
| Phase C: Members directory + intake policy | Completed | None | Codex + membership operators | Phase B complete | `src/lib/members/directory.ts`, `src/app/api/members/route.ts`, `src/app/(public)/members/page.tsx`, `src/app/api/membership-form/route.ts`, `src/app/(public)/membership-form/page.tsx`, `src/app/(public)/page.tsx`, `src/app/(public)/about/page.tsx` | `/members` supports tabs/search/alphabet/pagination with verification-aware workplace visibility; membership intake POST is disabled and status-check-only path remains |
| Phase D: Membership and ops backend completion | In progress | Staging DB still missing `membership_cycles`, `membership_cycle_memberships`, `invitation_batches`; rollover apply path blocked until migration is applied on target project | Codex + technical operators | Phase C complete | `supabase/migrations/20260409051000_membership_cycles_and_batches.sql`, `src/app/admin/membership/page.tsx`, `src/app/admin/membership/actions.ts`, `src/lib/db/types.ts`, `scripts/onboard-members.mjs`, `scripts/reconcile-members.mjs`, `scripts/rollover-membership-cycle.mjs`, `artifacts/reports/membership/membership-cycles-migration-blocker-20260409T074210Z.json` | Apply migration to staging and re-run rollover dry-run/apply with real cycle id, then capture success evidence |
| Phase E: Observability, rehearsal, cutover evidence | In progress | Sentry API token currently returns `403`; Cloudinary validation found `13` assets tracked in Supabase but `0` present under `jnuits/jnuits-full-stack` folder | Codex + project owner | Phase D migration blocker resolved for full closeout | `src/app/admin/reports/actions.ts`, `src/app/admin/reports/page.tsx`, `scripts/validate-cloudinary-assets.mjs`, `scripts/rollback-drill.mjs`, `scripts/build-cutover-evidence-pack.mjs`, `artifacts/reports/rehearsal/sentry-verification-report-20260409T074241Z.json`, `artifacts/reports/rehearsal/cloudinary-validation-report-20260409T073817Z.json`, `artifacts/reports/rehearsal/cutover-evidence-pack-20260409T074701Z.json` | Sentry protected-flow event verified end-to-end, Cloudinary folder parity fixed, cutover/rollback pack accepted |

## Evidence Rules

- Keep migration SQL files in `supabase/migrations/` and reference file names per phase.
- Keep report artifacts under `artifacts/reports/` with deterministic names.
- Capture verification commands (`lint`, `typecheck`, `build`) at each phase exit.
- Capture screenshots for critical public, portal, and admin flows before cutover.

## Phase A Completion Notes (2026-04-09)

- Added `super_admin` seed + hierarchy-aware role resolution in Supabase via migration.
- Added safe return-to behavior hardening:
  - login redirects now sanitize `next` to block open redirects.
  - auth guard now includes fallback-aware `next` handling.
- Fixed rehearsal script schema drift from `member_requests` to `profile_update_requests`.
- Added GitHub Actions quality gate (`lint`, `typecheck`, `build`) on `main` PRs and pushes.

## Phase B Completion Notes (2026-04-09)

- Added public detail routes for blogs, events, and gallery using canonical identifier redirect behavior.
- Added public committee term detail route plus legacy compatibility aliases for `/committee/5th` and `/committee/advisory`.
- Updated public content retrieval and fallback copy to remove migration-only narrative and improve production-facing parity.
- Validation evidence:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

## Phase C Completion Notes (2026-04-09)

- Implemented a production directory contract at `GET /api/members` with:
  - members/current/alumni filtering
  - search by member name or JnUITS ID
  - A-Z initial filtering
  - pagination metadata and counters
  - verification-aware workplace field visibility rules
- Replaced placeholder `/members` page with a parity-ready directory surface and verification guidance.
- Disabled new public intake at `POST /api/membership-form` with explicit closed-policy response (`410`) while preserving `/api/membership-form/status`.
- Updated public CTA copy to align with intake-closed policy (`/` and `/about`).
- Validation evidence:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

## Phase D Progress Notes (2026-04-09)

- Added renewal-ready membership lifecycle schema:
  - `membership_cycles`
  - `membership_cycle_memberships`
  - `invitation_batches`
  - RLS policies and operator write guards
- Hardened onboarding/reconciliation scripts for real data:
  - Removed invalid `departmentCode` length rule that blocked canonical slugs.
  - Added seeded-department normalization and alias resolution.
  - Added explicit write-failure counters and reporting rows in dry-run/apply outputs.
- Added membership cycle rollover automation script:
  - `npm run members:rollover-cycle -- ... --dry-run|--apply`
- Updated operator command references and onboarding CSV template to canonical department format.
- Completed Phase D operator UX surface for cycle/batch state control:
  - `src/app/admin/membership/page.tsx`
  - `src/app/admin/membership/actions.ts`
  - Admin navigation link in `src/lib/site.ts`
- Rehearsal executions completed:
  - `npm run members:onboard -- --file M:\\jnuits\\admin.jnuits.org.bd\\database\\templates\\phase8-member-onboarding-template.csv --dry-run --persist-report`
  - `npm run members:onboard -- --file M:\\jnuits\\admin.jnuits.org.bd\\database\\templates\\phase8-member-onboarding-template.csv --apply --persist-report`
  - `npm run members:reconcile -- --dry-run --persist-report`
  - `npm run members:reconcile -- --apply --persist-report`
- Current blocker:
  - `members:rollover-cycle` dry-run/apply currently fails on staging with `Could not find the table 'public.membership_cycles' in the schema cache`.
  - Blocker evidence: `artifacts/reports/membership/membership-cycles-migration-blocker-20260409T074210Z.json`

## Phase E Progress Notes (2026-04-09)

- Added protected Sentry verification action in admin reports (`triggerSentryVerificationReport`) and UI control in `/admin/reports`.
- Added new rehearsal tooling:
  - `npm run rehearse:cloudinary`
  - `npm run rehearse:rollback`
  - `npm run rehearse:evidence`
- Executed and archived evidence:
  - `artifacts/reports/rehearsal/cloudinary-validation-report-20260409T073817Z.json`
  - `artifacts/reports/rehearsal/cutover-rehearsal-report-20260409T073817Z.json`
  - `artifacts/reports/rehearsal/rollback-drill-report-20260409T073836Z.json`
  - `artifacts/reports/rehearsal/sentry-verification-report-20260409T074241Z.json`
  - `artifacts/reports/rehearsal/cutover-evidence-pack-20260409T074701Z.json`
- Open items:
  - Sentry project API verification blocked by token permission (`403`).
  - Cloudinary folder parity mismatch persists (`13` Supabase assets, `0` assets currently under expected folder `jnuits/jnuits-full-stack`).
