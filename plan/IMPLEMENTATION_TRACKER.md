# Implementation Tracker (Execution Plan v3)

| Phase | Status | Blocker | Owner | Prerequisites | Evidence | Exit Gate |
| --- | --- | --- | --- | --- | --- | --- |
| Phase A: Foundation corrections | Completed | None | Codex + project owner | `plan/New_Plan.md` approved | `supabase/migrations/20260409040000_super_admin_role_hierarchy.sql`, `src/lib/auth/session.ts`, `src/lib/supabase/proxy.ts`, `scripts/rehearse-cutover.mjs`, `.github/workflows/quality-gate.yml` | `npm run lint`, `npm run typecheck`, `npm run build` pass; protected redirect targets and role hierarchy fixes are applied |
| Phase B: Public parity restoration | Completed | None | Codex + content owner | Phase A complete | `src/app/(public)/blogs/[identifier]/page.tsx`, `src/app/(public)/events/[identifier]/page.tsx`, `src/app/(public)/gallery/[identifier]/page.tsx`, `src/app/(public)/committee/[termSlug]/page.tsx`, `src/app/(public)/committee/5th/page.tsx`, `src/app/(public)/committee/advisory/page.tsx`, `src/lib/content/public-content.ts`, `src/lib/committee/public.ts` | Legacy-critical detail routes and committee aliases resolve without parity-breaking 404s |
| Phase C: Members directory + intake policy | Completed | None | Codex + membership operators | Phase B complete | `src/lib/members/directory.ts`, `src/app/api/members/route.ts`, `src/app/(public)/members/page.tsx`, `src/app/api/membership-form/route.ts`, `src/app/(public)/membership-form/page.tsx`, `src/app/(public)/page.tsx`, `src/app/(public)/about/page.tsx` | `/members` supports tabs/search/alphabet/pagination with verification-aware workplace visibility; membership intake POST is disabled and status-check-only path remains |
| Phase D: Membership and ops backend completion | In progress | Remaining: operator UI for renewal lifecycle tables and end-to-end real-data rehearsal | Codex + technical operators | Phase C complete | `supabase/migrations/20260409051000_membership_cycles_and_batches.sql`, `scripts/lib/members.mjs`, `scripts/onboard-members.mjs`, `scripts/reconcile-members.mjs`, `scripts/rollover-membership-cycle.mjs`, `artifacts/templates/member-onboarding-template.csv`, `package.json`, `src/app/admin/reports/page.tsx` | Renewal-ready schema and deterministic scripts exist; remaining work focuses on full operator UX and rehearsal evidence |
| Phase E: Observability, rehearsal, cutover evidence | Pending | Awaiting implementation start | Codex + project owner | Phase D complete | Planned: production-safe Sentry verification, real-data rehearsal pack, rollback drill evidence | Cutover gate signed with reproducible reports and rollback proof |

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
