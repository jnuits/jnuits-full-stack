# JnUITS Full-Stack Gap Audit And Completion Plan (2026-04-09)

## Summary
- Current production is deployable and technically stable (`lint`, `typecheck`, `build` pass), but parity with the legacy site is still incomplete in key user-facing and operator flows.
- Live route audit confirms core public routes are up, certificate query compatibility works (`/certificates?q=24007`), and protected routes redirect to login.
- Critical gaps are now prioritized around: public detail route parity, member directory parity, role model finalization (`super_admin`), membership onboarding policy change (intake disabled), and rehearsal/ops completeness.

## Audit Findings To Close (Priority Order)
- P0: `super_admin` does not exist in RBAC tables; only `admin/moderator/content_editor/committee_author` are seeded.
- P0: Auth redirect flow does not preserve intended destination (`/portal` and `/admin` redirect to `/login` without `next`).
- P0: `scripts/rehearse-cutover.mjs` still references `member_requests` instead of `profile_update_requests`.
- P1: Public detail routes are missing (`/blogs/[id|slug]`, `/events/[id|slug]`, `/gallery/[id|slug]`), causing 404 parity gaps.
- P1: `/members` is still a transition shell; legacy-grade directory functionality is not restored.
- P1: Public copy across multiple pages remains migration-oriented instead of production institutional content.
- P1: Frequent failed production deployment history indicates missing pre-merge quality gate discipline.
- P2: Membership lifecycle model is simplified; renewal/cycle depth still needs full implementation for later phases.
- P2: Sentry is configured, but production verification evidence path is incomplete (debug endpoint is intentionally disabled in production).

## Implementation Plan (Decision Complete)
1. **Phase A: Foundation Corrections (Immediate)**
- Add `super_admin` role in RBAC migration and make role checks hierarchy-aware so `super_admin` inherits admin/operator privileges.
- Promote `jnuitsbd@gmail.com` to active `super_admin` grant.
- Fix auth return-to behavior for protected routes (`/admin`, `/portal`, `/profile`) end-to-end.
- Fix `rehearse-cutover` script table mismatch and regenerate rehearsal report contract.
- Add CI gate for `lint + typecheck + build` on main branch PRs/pushes.

2. **Phase B: Public Parity Restoration**
- Build detail pages for blogs/events/gallery with canonical dynamic routes and legacy identifier compatibility.
- Implement critical legacy aliases only:
  - `/committee/5th` and `/committee/advisory` redirect to canonical committee views.
  - Legacy content detail identifiers resolve to canonical blog/event/gallery detail pages.
- Replace migration narrative copy with finalized institutional/public-facing copy from DB-backed content.
- Ensure all public pages maintain responsive behavior at mobile/tablet/desktop breakpoints.

3. **Phase C: Members Directory And Onboarding Policy**
- Implement full directory API + UI parity (`/api/members` + `/members`) with:
  - Members/alumni tabs, counters, search, alphabetical filter, pagination.
  - Verification gate behavior for restricted workplace fields.
  - Alumni workplace request visibility and activity history.
- Disable new public membership intake now:
  - `/membership-form` becomes closed/intake-disabled info route.
  - `POST /api/membership-form` returns controlled 410/disabled response.
  - Keep status-check endpoint only for legacy applicants (read-only).

4. **Phase D: Membership/Ops Backend Completion**
- Extend schema for renewal-ready lifecycle (`membership_cycles`, `membership_records`, invitation batch tracking, renewal queue artifacts) without regressing current claim flow.
- Complete committee rollover evidence workflow and operator report consistency for each sensitive mutation.
- Finalize reconciliation and CSV onboarding reports with deterministic dry-run/apply outputs.

5. **Phase E: Observability, Rehearsal, And Cutover Evidence**
- Add authenticated operator-only Sentry verification action for production-safe telemetry checks.
- Validate Cloudinary-first media flow with real assets under `jnuits/jnuits-full-stack/**`.
- Run production-like rehearsal pack:
  - Real CSV onboarding/reconcile dry-run + apply validation.
  - Public content/media import with parity reports.
  - Committee rollover simulation and rollback drill evidence.

## Public/API/Schema Changes
- **RBAC**
- Add platform role: `super_admin`.
- Update role-evaluation logic to treat `super_admin` as top-tier operator across policy checks.

- **Public Routes**
- Add detail routes: `/blogs/[identifier]`, `/events/[identifier]`, `/gallery/[identifier]`.
- Add critical compatibility aliases for legacy committee paths.

- **Membership Intake**
- Change `POST /api/membership-form` behavior to disabled mode.
- Keep `/api/membership-form/status` for legacy read-only checks.

- **Directory**
- Add/restore `GET /api/members` contract for paginated/filterable directory output.

- **Data**
- Add legacy identifier fields where needed for detail-route compatibility resolution.
- Add renewal/cycle tables required for membership lifecycle completion.

## Test Plan And Exit Gates
- **Platform**
- `npm run lint`, `npm run typecheck`, `npm run build` pass locally and in Vercel preview.
- No production deploy from main without passing CI gate.

- **Security/Auth**
- Protected-route redirects preserve `next` target and cannot be abused for open redirects.
- `super_admin` authorization verified across admin/operator actions.
- RLS regression checks pass for anonymous/authenticated/operator scopes.

- **Public Parity**
- Legacy-critical URLs resolve correctly.
- Detail pages render from real data for blogs/events/gallery.
- `/members` parity scenarios pass (search/filter/pagination/gated fields).

- **Operations/Rehearsal**
- `rehearse-cutover` script runs successfully and reports correct tables.
- CSV onboarding/reconciliation dry-run and apply reports are reproducible.
- Committee rollover and audit logs generate evidence records.

- **Observability**
- Sentry client/server/edge telemetry validated with production-safe operator-triggered test event and recorded evidence.

## Assumptions And Defaults
- Decision locked: introduce real `super_admin` role now.
- Decision locked: support critical legacy URL aliases only (not every historical path).
- Decision locked: disable new public membership intake immediately.
- Runtime baseline remains Node `24.14.1`; Next.js remains `16.2.2` (as of 2026-04-09, “Next.js 24.x” is not a valid Next.js release line).
- Existing Vercel project (`jnuits-full-stack`) and Supabase project remain the active targets.
- Cloudinary remains the sole store for large public photos/videos; Supabase stores metadata and relationships.
