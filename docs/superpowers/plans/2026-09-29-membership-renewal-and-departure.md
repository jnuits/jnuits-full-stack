# Membership Renewal and Departure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual membership-cycle windows with per-member annual anniversaries, a six-month grace period, audited renewal confirmation, restricted former-member access, voluntary departure, one appeal, and preserved future alumni eligibility.

**Architecture:** PostgreSQL owns authoritative anniversary calculation, transactional renewal advancement, lifecycle reconciliation, and request-state transitions. Next.js loaders call the same bounded reconciliation RPC used by daily Supabase Cron, then project an access mode of mutable, restricted, or blocked. Existing request/audit infrastructure is extended; dormant cycle tables remain for one rollback-compatible release but receive no new writes.

**Tech Stack:** Next.js 16 App Router and Server Actions, React 19, TypeScript, Supabase Auth/PostgreSQL/Cron, Zod, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-membership-lifecycle-committee-finalization-design.md`

## Global Constraints

- Execute after `2026-09-29-member-intake-catalog-and-guidance.md` and before committee finalization.
- Before changing App Router loaders, redirects, forms, or actions, read `node_modules/next/dist/docs/01-app/02-guides/forms.md`, `server-actions.md`, and the local `redirect`/`revalidatePath` API guides.
- PostgreSQL is authoritative for anniversary and state transitions. TypeScript may format or project states but must not implement a competing transition policy.
- Evaluate policy dates in the `Asia/Dhaka` calendar. Pass explicit dates to database functions so tests and cron are deterministic.
- A 29 February member renews on 28 February in non-leap years and 29 February in leap years; calculate from the original joining month/day so the leap date is recoverable.
- One paid/waived confirmation satisfies one anniversary. Never imply a payment gateway exists and never store financial secrets.
- Grace-period members remain current and mutable. Former members with active security access remain authenticated but cannot mutate normal member data.
- Voluntary departure is not `portal_access_status=frozen`. Security freezes/suspensions/deactivation remain independently authoritative.
- Preserve identity, committee history, last renewal due date, and ledger rows through former/departed/alumni transitions.
- Do not drop `membership_cycles`, `membership_cycle_memberships`, or nullable historical cycle foreign keys in this release.
- Use the Supabase skill and official Cron/database guidance for DDL, RLS, function security, scheduling, and production verification.

## Review Focus

- Exact due/grace/former boundaries, month/year rollover, and every leap-year case use Dhaka dates and are idempotent.
- A former/current row is never made mutable by `member_type=current`; active security access permits only the restricted surface.
- Renewal catches up one period at a time and reactivates only after the resulting due date is in the future.
- Departure request, withdrawal, closure, single appeal, final rejection, and later alumni eligibility cannot be bypassed by direct actions/RPC calls.
- Cycle UI and writes are retired without destructively removing legacy tables or corrupting old application records.

---

### Task 1: Anniversary and lifecycle presentation contracts

**Files:**
- Create: `src/lib/membership/anniversary.ts`
- Create: `src/lib/membership/anniversary.test.ts`
- Create: `src/lib/membership/lifecycle.ts`
- Create: `src/lib/membership/lifecycle.test.ts`

**Interfaces:**
- Add `formatDhakaDate`, `formatRenewalState`, and pure test helpers for displaying database-returned states.
- Add `MembershipAccessMode = "mutable" | "restricted" | "blocked"` and `resolveMembershipAccessMode(snapshot)`.
- Do not export a TypeScript mutation function that claims to advance authoritative renewal state.

- [ ] **Step 1: Write failing date/display/access tests**

  Cover ordinary dates, year boundaries, leap-year display, exact due date, exact six-month boundary, grace wording, open/departure-requested/closed-appealable/closed-final paths, current/former/alumni/deleted lifecycle, and each security status.

- [ ] **Step 2: Run tests and verify RED**

  Run: `npx vitest run --project node src/lib/membership/anniversary.test.ts src/lib/membership/lifecycle.test.ts`

  Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement minimal projection helpers**

  Accept ISO date-only strings from the database, avoid browser-local midnight conversion, and keep access precedence explicit: blocked security first, restricted former/path state second, mutable current/alumni according to existing role rules.

- [ ] **Step 4: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/membership/anniversary.test.ts src/lib/membership/lifecycle.test.ts`

  Run: `npm run typecheck`

- [ ] **Step 5: Commit**

  Commit: `feat(membership): define renewal access states`

### Task 2: Renewal ledger, lifecycle functions, and Cron migration

**Files:**
- Create: `supabase/migrations/20260929120000_membership_anniversary_lifecycle.sql`
- Create: `src/lib/membership/renewal-lifecycle-migration.test.ts`
- Modify: `src/lib/db/types.ts` (generated only)
- Modify: `src/lib/committee/onboarding/generated-db-types.test.ts`

**Database contract:**
- Add `members.renewal_due_on`, `current_membership_path_status`, path case/closure/appeal metadata, and supporting queue indexes.
- Create append-oriented `membership_renewals` with unique `(member_id, due_on)`, `paid|waived`, confirmation/result dates, safe reference/note, actor, timestamps, RLS, and operator-only writes.
- Extend `profile_update_requests.request_type` without dropping existing allowed values for `membership_renewal`, `membership_departure`, and `membership_departure_appeal`.
- Add an immutable/leakproof-safe anniversary helper, an idempotent bounded reconciliation function, an operator renewal-confirmation function, and member/operator request-transition functions.
- Schedule one idempotent daily `pg_cron` job shortly after Dhaka midnight using an explicit Dhaka date expression.

- [ ] **Step 1: Write a failing SQL contract test**

  Assert field checks, indexes, ledger uniqueness, request-type preservation, `SECURITY DEFINER` plus empty `search_path`, qualified relations, actor derivation, permission checks, revoked anonymous/authenticated execution where appropriate, bounded reconciliation, lifecycle-event idempotency, and idempotent cron schedule replacement.

- [ ] **Step 2: Run the contract test and verify RED**

  Run: `npx vitest run --project node src/lib/membership/renewal-lifecycle-migration.test.ts`

  Expected: FAIL because the migration is absent.

- [ ] **Step 3: Implement date and transition SQL test-first**

  Add SQL assertions to the migration/replay fixture for `2024-02-29 -> 2025-02-28 -> 2028-02-29`, exact due and six-month boundaries, one-period confirmation, multi-period catch-up, no duplicate renewal/event on retry, security-status preservation, and refusal when `joined_on` is unknown.

- [ ] **Step 4: Implement request state machines in the same transaction boundary**

  A departure request creates a case and sets `departure_requested`; withdrawal restores `open`; approval sets `closed_appealable`; one case-scoped appeal can restore `open` or move to `closed_final`. Reject renewal confirmation for closed paths. Alumni conversion remains allowed from former/closed states and records a non-appealable `alumni_conversion` closure reason.

- [ ] **Step 5: Replay and regenerate types**

  Run: `npm run db:replay-bootstrap`

  Run: `npm run db:types:generate`

  Run: `npx vitest run --project node src/lib/membership/renewal-lifecycle-migration.test.ts src/lib/committee/onboarding/generated-db-types.test.ts`

  Expected: PASS on a clean scratch database with generated renewal/path fields.

- [ ] **Step 6: Commit**

  Commit: `feat(db): add anniversary membership lifecycle`

### Task 3: Remove cycle-bound application approval and writes

**Files:**
- Modify: `src/app/admin/membership/moderation-actions.ts`
- Create: `src/app/admin/membership/moderation-actions.test.ts`
- Modify: `src/lib/forms/membership-application-decisions-migration.test.ts`
- Modify: `src/lib/forms/annual-membership-workflow.test.ts`
- Modify: `src/app/admin/membership/actions.ts`
- Modify: `src/components/admin/membership-db-client.tsx`
- Create: `src/components/admin/membership-db-client.dom.test.tsx`
- Modify: `src/app/admin/membership/page.tsx`

**Interfaces:**
- Approval accepts an optional reviewed official joining date and defaults to the Dhaka approval date.
- JnUITS ID allocation uses `extract(year from joined_on)` rather than a cycle year.
- Remove `CycleAndEnrollmentForms` and active cycle data from page/client props.
- Remove or hard-retire cycle-writing Server Actions so new code cannot create/enroll/transition cycle rows.

- [ ] **Step 1: Write failing approval/deprecation tests**

  Prove approval succeeds with no cycle, writes `joined_on` and initial `renewal_due_on`, allocates the correct year block, accepts an authorized earlier official date, rejects a future/invalid date, and never inserts into `membership_cycle_memberships`.

- [ ] **Step 2: Add source/DOM invariants**

  Assert the membership page has no Create cycle, open/close renewal window, active-cycle requirement, `CycleAndEnrollmentForms`, or callable cycle-write action, while legacy tables remain in generated types.

- [ ] **Step 3: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/app/admin/membership/moderation-actions.test.ts src/lib/forms/membership-application-decisions-migration.test.ts src/lib/forms/annual-membership-workflow.test.ts`

  Run: `npm run test:dom -- src/components/admin/membership-db-client.dom.test.tsx`

  Expected: FAIL on the current cycle requirement and UI.

- [ ] **Step 4: Implement approval and UI retirement**

  Keep nullable historical `membership_cycle_id` values readable, but stop assigning them. Remove only obsolete UI/actions and leave rollback-compatible tables/migrations untouched.

- [ ] **Step 5: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/app/admin/membership/moderation-actions.test.ts src/lib/forms/membership-application-decisions-migration.test.ts src/lib/forms/annual-membership-workflow.test.ts`

  Run: `npm run test:dom -- src/components/admin/membership-db-client.dom.test.tsx`

  Run: `npm run typecheck`

- [ ] **Step 6: Commit**

  Commit: `refactor(membership): retire manual cycle workflow`

### Task 4: Separate authenticated, mutable, restricted, and blocked portal access

**Files:**
- Modify: `src/lib/auth/session.ts`
- Modify: `src/lib/auth/session.test.ts`
- Modify: `src/lib/portal/member.ts`
- Create: `src/lib/portal/member.test.ts`
- Modify: `src/app/(portal)/portal/layout.tsx`
- Modify: `src/app/(portal)/portal/page.tsx`
- Modify: `src/components/portal/portal-shell.tsx`
- Modify: `src/components/portal/portal-shell.dom.test.tsx`

**Interfaces:**
- Add `requirePortalIdentity()` for an authenticated member/advisor identity whose security state permits sign-in.
- Keep `requirePortalUser()` as the mutable-member guard used by mutation screens/actions.
- Add `PortalAccessMode` to the snapshot and include joined date, renewal due date, path status, and safe closure state.
- Reconciliation of the signed-in member calls the database function through server-only code before access is resolved.

- [ ] **Step 1: Write failing guard and snapshot tests**

  Prove former/current is restricted, grace current is mutable, active alumni follows existing alumni permissions, suspended/frozen/deactivated/deleted is blocked as defined, restricted users are directed to `/portal/membership`, and no fallback to `member_type=current` restores mutability.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/lib/auth/session.test.ts src/lib/portal/member.test.ts`

  Run: `npm run test:dom -- src/components/portal/portal-shell.dom.test.tsx`

  Expected: FAIL because the current mutable fallback and single guard conflate states.

- [ ] **Step 3: Implement access separation**

  Resolve security restriction before lifecycle. Do not send former users to login or expose normal mutation routes. Keep operator/advisor behavior intact and avoid an authorization decision in client-only code.

- [ ] **Step 4: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/auth/session.test.ts src/lib/auth/session-admin-guard.test.ts src/lib/portal/member.test.ts`

  Run: `npm run test:dom -- src/components/portal/portal-shell.dom.test.tsx`

  Run: `npm run typecheck`

- [ ] **Step 5: Commit**

  Commit: `fix(portal): preserve restricted former access`

### Task 5: Former-member portal and member request actions

**Files:**
- Create: `src/app/(portal)/portal/membership/page.tsx`
- Create: `src/app/(portal)/portal/membership/actions.ts`
- Create: `src/app/(portal)/portal/membership/actions.test.ts`
- Create: `src/components/portal/former-member-screen.tsx`
- Create: `src/components/portal/former-member-screen.dom.test.tsx`
- Modify: `src/app/(portal)/portal/profile/actions.ts`
- Modify: `src/app/api/portal/workplace-requests/route.ts`

**Interfaces:**
- Add actions for renewal/reactivation request, alumni request handoff, departure request, pending departure withdrawal, and one departure appeal.
- Every action derives the member from the authenticated user; no client-provided member ID controls ownership.
- The restricted screen receives a minimal safe DTO and no editable normal-profile form.

- [ ] **Step 1: Write failing action/state tests**

  Cover ownership, CSRF/action validation, open-path renewal request, no fake payment confirmation, strong departure confirmation token, pending withdrawal, appeal only from `closed_appealable`, no second appeal, alumni request from every eligible former path, and security-blocked rejection.

- [ ] **Step 2: Write failing DOM tests**

  Assert outstanding anniversary and fee guidance, plain-language choices, consequence copy, pending/appeal/final states, non-destructive/destructive distinction, absence of normal edit fields, accessible errors/status, and mobile keyboard usability.

- [ ] **Step 3: Run focused tests and verify RED**

  Run: `npx vitest run --project node 'src/app/(portal)/portal/membership/actions.test.ts'`

  Run: `npm run test:dom -- src/components/portal/former-member-screen.dom.test.tsx`

  Expected: FAIL because the route/actions/component do not exist.

- [ ] **Step 4: Implement the restricted workflow**

  Use database RPCs from Task 2, existing request review/audit records, and `revalidatePath` for the portal/member admin views. The UI says an administrator confirms renewal; it never says payment was processed online.

- [ ] **Step 5: Run focused tests and typecheck**

  Run: `npx vitest run --project node 'src/app/(portal)/portal/membership/actions.test.ts'`

  Run: `npm run test:dom -- src/components/portal/former-member-screen.dom.test.tsx`

  Run: `npm run typecheck`

- [ ] **Step 6: Commit**

  Commit: `feat(portal): add former member lifecycle choices`

### Task 6: Administrative renewal and membership-path queue

**Files:**
- Create: `src/components/admin/membership-renewal-panel.tsx`
- Create: `src/components/admin/membership-renewal-panel.dom.test.tsx`
- Create: `src/app/admin/membership/renewal-actions.ts`
- Create: `src/app/admin/membership/renewal-actions.test.ts`
- Modify: `src/app/admin/membership/page.tsx`
- Modify: `src/components/admin/membership-db-client.tsx`
- Modify: `src/app/admin/membership/actions.ts`

**Interfaces:**
- Add paginated queues for unknown joining date, upcoming/overdue renewals, former reactivation requests, departure reviews, and appeals.
- Add permission-checked renewal confirmation/waiver and request review actions with expected due date/request revision.
- Return stable action results that distinguish stale state, invalid transition, permission denial, and database failure.

- [ ] **Step 1: Write failing action tests**

  Cover permission checks, expected-due idempotency, one-period advance, paid/waived audit fields, no sensitive payment data, catch-up behavior, reactivation only when current, departure approval/rejection, appeal approval/rejection, stale request refusal, and preserved `portal_access_status`.

- [ ] **Step 2: Write failing DOM tests**

  Assert clear queue grouping, joining-date correction path, overdue duration, confirmation dialogs, safe reference/note labels, disabled invalid actions, resulting status messages, and no legacy cycle controls.

- [ ] **Step 3: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/app/admin/membership/renewal-actions.test.ts`

  Run: `npm run test:dom -- src/components/admin/membership-renewal-panel.dom.test.tsx`

  Expected: FAIL because the administrative workflow does not exist.

- [ ] **Step 4: Implement server-paginated queues and actions**

  Select explicit columns, never load the whole member table into the client, use Task 2 RPCs, and refresh only affected admin/portal routes. Keep Content Admin unauthorized.

- [ ] **Step 5: Run focused tests, access audit, and typecheck**

  Run: `npx vitest run --project node src/app/admin/membership/renewal-actions.test.ts`

  Run: `npm run test:dom -- src/components/admin/membership-renewal-panel.dom.test.tsx`

  Run: `npm run audit:admin-access`

  Run: `npm run typecheck`

- [ ] **Step 6: Commit**

  Commit: `feat(admin): manage member renewals and departures`

### Task 7: Cron and loader-fallback integration verification

**Files:**
- Create: `src/lib/membership/reconciliation.ts`
- Create: `src/lib/membership/reconciliation.test.ts`
- Modify: `src/lib/portal/member.ts`
- Modify: `src/app/admin/membership/page.tsx`

**Interfaces:**
- Add a server-only `reconcileMembershipLifecycle({ memberId?, effectiveDate?, batchSize? })` wrapper around the single database function.
- Portal uses a member-scoped call; admin queue uses bounded reconciliation; Cron invokes the same SQL function.

- [ ] **Step 1: Write failing wrapper/fallback tests**

  Prove the wrapper never duplicates rules, member fallback scopes to one member, queue fallback is bounded, database errors fail safely, and two calls on the transition date produce one former event.

- [ ] **Step 2: Run tests and verify RED**

  Run: `npx vitest run --project node src/lib/membership/reconciliation.test.ts`

  Expected: FAIL because the wrapper does not exist.

- [ ] **Step 3: Implement the minimal server-only wrapper**

  Use explicit date-only values and safe logging. Do not make the RPC callable directly by an untrusted browser role.

- [ ] **Step 4: Verify scheduled job in scratch SQL**

  After replay, inspect `cron.job` for exactly one named JnUITS renewal job and invoke the function twice with a fixed date to prove event idempotency.

- [ ] **Step 5: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/membership/reconciliation.test.ts src/lib/membership/renewal-lifecycle-migration.test.ts`

  Run: `npm run typecheck`

- [ ] **Step 6: Commit**

  Commit: `feat(membership): reconcile lifecycle through one rpc`

### Task 8: Renewal/departure integration verification

**Files:**
- Modify only focused tests/docs for verified gaps; do not begin committee finalization.

- [ ] **Step 1: Run focused lifecycle suites**

  Run: `npx vitest run --project node src/lib/membership src/lib/auth/session.test.ts src/lib/portal/member.test.ts 'src/app/(portal)/portal/membership/actions.test.ts' src/app/admin/membership/renewal-actions.test.ts src/lib/forms/membership-application-decisions-migration.test.ts`

  Run: `npm run test:dom -- src/components/portal/former-member-screen.dom.test.tsx src/components/admin/membership-renewal-panel.dom.test.tsx src/components/portal/portal-shell.dom.test.tsx`

- [ ] **Step 2: Replay database and run all quality gates**

  Run: `npm run db:replay-bootstrap`

  Run: `npm run typecheck`

  Run: `npm run lint`

  Run: `npm run test:node`

  Run: `npm run test:dom`

  Run: `npm run build`

  Run: `npm run audit:admin-access`

  Run: `npm run audit:admin-ui`

- [ ] **Step 3: Browser-test lifecycle states**

  With synthetic local accounts/fixtures, verify paid current, overdue grace, former open, departure pending, appealable, final-closed, alumni, and security-frozen states at 375/768/1024/1440 in both themes. Confirm former users cannot reach edit/actions through direct URLs.

- [ ] **Step 4: Review security and data invariants**

  Confirm no browser role can confirm renewal/review requests directly, no user controls actor/member IDs, no financial secrets are stored, no security status is reactivated, and legacy cycle tables remain present but unwritten.

- [ ] **Step 5: Commit verification-only corrections**

  Commit: `test(membership): verify anniversary lifecycle workflow`
