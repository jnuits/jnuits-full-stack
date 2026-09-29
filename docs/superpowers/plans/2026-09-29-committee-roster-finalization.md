# Committee Roster Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Committee administration a canonical-member assignment workflow with explicit seats/vacancies and an atomic, stale-safe finalization step that converts eligible outgoing executive members to alumni exactly once.

**Architecture:** The database owns roster revisioning, readiness, predecessor comparison, finalization, lifecycle transitions, and locks. A read-only preview RPC returns a digest and privacy-safe impact DTO; the finalize RPC locks and recomputes the same state before committing. The admin UI searches the full canonical member catalog, edits assignments/vacancies only while a roster is open, and exposes no spreadsheet-import entry point.

**Tech Stack:** Next.js 16 Server Actions, React 19, TypeScript, Zod, Supabase/PostgreSQL, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-membership-lifecycle-committee-finalization-design.md`

## Global Constraints

- Execute after the intake/catalog and renewal/departure plans dated 2026-09-29.
- Before changing Server Actions, forms, redirects, or cache invalidation, read the local Next.js 16 forms, Server Actions, caching, revalidation, and `revalidatePath` guides under `node_modules/next/dist/docs/`.
- Committee assignments must reference existing `members`; never create a member, duplicate profile, copied avatar URL, or synthetic vacant member.
- Every target seat is assigned or counted vacant with an administrator reason before finalization.
- Preview is read-only. Finalization locks and revalidates every input and refuses a stale revision/digest.
- Actual prior service is `active` or `completed` and has a linked member. Planned/display-only/advisor rows do not drive alumni conversion.
- Preserve `portal_access_status` during alumni conversion. Frozen/suspended/deactivated people must not be reactivated.
- Finalization is idempotent. Reopening requires permission and a reason and never reverses lifecycle events.
- Preserve the shared onboarding parser/draft/database compatibility code, but remove every active Committee UI link to roster import.
- Historical corrections must be evidence-backed, guarded, rerunnable, and limited to exact identities/terms. Never reconstruct missing rosters speculatively.
- Use the Supabase skill and refresh official database function, locking, RLS, and advisor guidance before DDL or remote migration work.

## Review Focus

- Missing seats, unexplained vacancies, duplicate seats/members, over-capacity positions, invalid dates, stale previews, and concurrent edits all fail before mutation.
- Continuing prior-EC members remain current; absent prior actual-service members become alumni once; planned/display-only/advisors are excluded.
- Security restrictions survive finalization and already-alumni people are idempotent no-ops.
- Finalized rosters reject ordinary edits, and a reasoned reopen does not roll lifecycle history backward.
- Committee administration contains only member search/select assignment—not roster CSV/XLSX/paste/Google-Sheet import.

---

### Task 1: Roster finalization, vacancy, and revision migration

**Files:**
- Create: `supabase/migrations/20260929130000_committee_roster_finalization.sql`
- Create: `src/lib/committee/finalization-migration.test.ts`
- Modify: `src/lib/db/types.ts` (generated only)
- Modify: `src/lib/committee/onboarding/generated-db-types.test.ts`

**Database contract:**
- Add `committee_assignments.seat_number` with deterministic legacy backfill and uniqueness per term/position/seat for live rows.
- Add `committee_term_positions.vacant_slots` and `vacancy_reason`, with `assigned + vacant = target_slots` enforced at finalization rather than by fake rows.
- Add `committee_terms.roster_status`, monotonic `roster_revision`, finalization digest/result/timestamps/actor, and reopen attribution.
- Add revision-bump and finalized-roster edit guards for term positions/assignments.
- Add read-only `preview_committee_term_finalization(term_id)` and transactional `finalize_committee_term(term_id, expected_revision, expected_digest)` plus `reopen_committee_term(term_id, reason)`.

- [ ] **Step 1: Write a failing migration contract test**

  Assert additive columns/checks/indexes; no fake vacancy assignments; deterministic seat backfill; revision triggers; finalization lock; `SECURITY DEFINER` with empty `search_path`; qualified relations; `auth.uid()` actor derivation; `admin.committee.manage`; no anonymous execution; and lifecycle/audit insertion.

- [ ] **Step 2: Run the contract test and verify RED**

  Run: `npx vitest run --project node src/lib/committee/finalization-migration.test.ts`

  Expected: FAIL because the migration and functions do not exist.

- [ ] **Step 3: Implement readiness and impact SQL with fixed fixtures**

  Add replay assertions for complete assignments; explained vacancy; below minimum; over target/maximum; duplicate/conflicting member; missing member link on public actual service; invalid successor start/predecessor; continuing member; absent prior member; planned prior member; advisor exclusion; already alumni; and frozen/suspended access preservation.

- [ ] **Step 4: Implement stale-safe, idempotent finalization**

  The preview digest covers term revision, dates, position/seat/vacancy configuration, assignment identity/status/visibility, predecessor selection, and impacted member lifecycle/security values. Finalization locks and recomputes in stable order. An identical retry returns the stored result; changed inputs fail without partial updates or duplicate events.

- [ ] **Step 5: Implement guarded reopen**

  Reopen changes only roster editability/revision, records actor/reason/audit, and never reverses alumni transitions. Corrections use the existing explicit membership lifecycle path.

- [ ] **Step 6: Replay and regenerate types**

  Run: `npm run db:replay-bootstrap`

  Run: `npm run db:types:generate`

  Run: `npx vitest run --project node src/lib/committee/finalization-migration.test.ts src/lib/committee/onboarding/generated-db-types.test.ts`

  Expected: PASS with the new finalization fields/functions in generated types.

- [ ] **Step 7: Commit**

  Commit: `feat(db): add atomic committee finalization`

### Task 2: Typed finalization preview and action boundary

**Files:**
- Create: `src/lib/committee/finalization.ts`
- Create: `src/lib/committee/finalization.test.ts`
- Create: `src/app/admin/committee/finalization-actions.ts`
- Create: `src/app/admin/committee/finalization-actions.test.ts`
- Modify: `src/lib/committee/revalidation.ts`
- Modify: `src/lib/committee/revalidation.test.ts`

**Interfaces:**
- Add Zod-backed `CommitteeFinalizationPreview`, `FinalizationPosition`, `FinalizationMemberImpact`, and `CommitteeFinalizationResult` DTOs.
- Add `loadCommitteeFinalizationPreview(termId)`, `finalizeCommitteeRosterAction(input)`, and `reopenCommitteeRosterAction(input)`.
- DTOs expose name/JnUITS ID/current lifecycle/security-preservation warning only; omit private member fields.

- [ ] **Step 1: Write failing parser/action tests**

  Cover malformed RPC JSON, deterministic position/seat ordering, blockers/warnings, continuing/alumni lists, preserved restriction indicators, required expected revision/digest, permission failure, stale response, idempotent success, mandatory reopen reason, safe database errors, and revalidation after success only.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/lib/committee/finalization.test.ts src/app/admin/committee/finalization-actions.test.ts src/lib/committee/revalidation.test.ts`

  Expected: FAIL because the typed boundary does not exist.

- [ ] **Step 3: Implement minimal server-only boundary**

  Parse every RPC result, derive authorization server-side, keep actor IDs out of inputs, and distinguish validation blockers, stale state, permission denial, and unexpected failure. Revalidate current/historical committee pages and affected public member routes after finalization.

- [ ] **Step 4: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/committee/finalization.test.ts src/app/admin/committee/finalization-actions.test.ts src/lib/committee/revalidation.test.ts`

  Run: `npm run typecheck`

- [ ] **Step 5: Commit**

  Commit: `feat(committee): expose finalization actions`

### Task 3: Seat-aware canonical-member assignment workflow

**Files:**
- Modify: `src/components/admin/committee-workspace-client.tsx`
- Modify: `src/components/admin/committee-member-search.tsx`
- Modify: `src/components/admin/committee-member-search.dom.test.tsx`
- Create: `src/components/admin/committee-assignment-form.dom.test.tsx`
- Modify: `src/app/admin/committee/actions.ts`
- Modify: `src/app/admin/committee/actions.position.test.ts`
- Modify: `src/app/admin/committee/page.tsx`

**Interfaces:**
- Extend `CommitteeAssignmentClientRecord` with `seatNumber` and finalization lock state.
- Extend position DTOs with `vacantSlots` and `vacancyReason`.
- `saveCommitteeAssignment` requires a canonical member selection and expected roster revision for public actual-service appointments.
- Keep `searchOnboardingMembersAction`/member search server-paginated rather than sending a capped catalog to the client.

- [ ] **Step 1: Write failing assignment/action tests**

  Cover search by JnUITS ID/name/email beyond the first page; explicit seat selection; duplicate seat/member; position capacity; linked member requirement; status/date rules; vacancy count/reason; revision mismatch; finalized edit refusal; and normal edits after reasoned reopen.

- [ ] **Step 2: Write failing DOM tests**

  Assert term -> position -> seat -> member search order, selected identity confirmation, no free-text member creation, clear vacant-seat controls, locked finalized state, and accessible mobile form semantics.

- [ ] **Step 3: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/app/admin/committee/actions.position.test.ts`

  Run: `npm run test:dom -- src/components/admin/committee-member-search.dom.test.tsx src/components/admin/committee-assignment-form.dom.test.tsx`

  Expected: FAIL on missing seat/vacancy/revision contracts.

- [ ] **Step 4: Implement assignment and vacancy editing**

  Keep search debounced/paginated and preserve identity conflict rules. Do not permit assignment save until the selected member resolves to a canonical ID. Write vacancies to `committee_term_positions`, never `committee_assignments`.

- [ ] **Step 5: Run focused tests, access audit, and typecheck**

  Run: `npx vitest run --project node src/app/admin/committee/actions.position.test.ts`

  Run: `npm run test:dom -- src/components/admin/committee-member-search.dom.test.tsx src/components/admin/committee-assignment-form.dom.test.tsx`

  Run: `npm run audit:admin-access`

  Run: `npm run typecheck`

- [ ] **Step 6: Commit**

  Commit: `feat(admin): assign committee seats from members`

### Task 4: Readiness, impact preview, finalization, and reopen UI

**Files:**
- Create: `src/components/admin/committee-finalization-panel.tsx`
- Create: `src/components/admin/committee-finalization-panel.dom.test.tsx`
- Modify: `src/components/admin/committee-workspace-client.tsx`
- Modify: `src/app/admin/committee/page.tsx`
- Modify: `src/app/globals.css` only for minimal existing-theme layout rules if component utilities are insufficient

**Interfaces:**
- Panel loads/refreshes the Task 2 preview for the selected term.
- Finalize submits exact preview revision/digest and requires explicit consequence acknowledgement.
- Reopen requires a non-empty reason and explains that lifecycle transitions are not reversed.

- [ ] **Step 1: Write failing DOM tests**

  Cover assigned/vacant positions; blockers vs warnings; continuing vs automatic-alumni sections; preserved security restriction label; stale-refresh flow; disabled finalization while blocked; acknowledgement; success summary; finalized lock; and reasoned reopen warning.

- [ ] **Step 2: Run the DOM test and verify RED**

  Run: `npm run test:dom -- src/components/admin/committee-finalization-panel.dom.test.tsx`

  Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement the panel in the existing workspace**

  Use plain-language labels, a read-only preview, stable member identifiers, visually distinct finalization/reopen actions, live-region result messages, and no optimistic assumption that a stale finalize succeeded.

- [ ] **Step 4: Run focused DOM/UI tests**

  Run: `npm run test:dom -- src/components/admin/committee-finalization-panel.dom.test.tsx src/components/admin/committee-member-search.dom.test.tsx`

  Run: `npm run audit:admin-ui`

  Run: `npm run typecheck`

- [ ] **Step 5: Commit**

  Commit: `feat(admin): review and finalize committee rosters`

### Task 5: Remove Committee roster-import entry points

**Files:**
- Modify: `src/components/admin/committee-workspace-client.tsx`
- Delete: `src/components/admin/committee-onboarding-panel.tsx`
- Delete: `src/components/admin/committee-onboarding-panel.dom.test.tsx`
- Modify: `src/lib/committee/onboarding/committee-admin-integration.test.ts`
- Modify: `src/app/admin/committee/actions.ts` only to remove unreachable legacy direct-import UI handlers when no other caller remains

**Compatibility contract:**
- Keep `committee_roster_import` in shared database/onboarding contracts for this rollback-compatible release.
- Keep generic parsers and member-profile intake code.
- No Committee page, panel, button, text, or client import references `IntakeWorkspace`, CSV/XLSX/paste, or Google Sheet roster capture.

- [ ] **Step 1: Change integration tests to the new invariant**

  Add a failing source/DOM assertion that Committee renders member search, seat/vacancy controls, and finalization but no roster importer. Assert Membership DB still renders `IntakeWorkspace operationType="member_profile_import"`.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/lib/committee/onboarding/committee-admin-integration.test.ts src/lib/committee/onboarding/membership-admin-integration.test.ts`

  Expected: FAIL because `CommitteeOnboardingPanel` is still mounted.

- [ ] **Step 3: Remove only active Committee entry points**

  Delete the wrapper and its dead imports. Remove a legacy direct-import Server Action only after `rg` proves no client/server consumer remains; otherwise leave it deprecated and unlinked for rollback compatibility.

- [ ] **Step 4: Run onboarding regression tests**

  Run: `npx vitest run --project node src/lib/committee/onboarding`

  Run: `npm run test:dom -- src/components/admin/onboarding/intake-workspace.dom.test.tsx`

  Run: `npm run typecheck`

  Expected: Committee import is absent while Membership intake remains functional.

- [ ] **Step 5: Commit**

  Commit: `refactor(committee): remove roster import entry point`

### Task 6: Evidence-backed JNUITS-2023001 lifecycle correction

**Files:**
- Create: `supabase/migrations/20260929131000_correct_verified_ec_alumni_transition.sql`
- Create: `src/lib/committee/verified-alumni-correction-migration.test.ts`

**Data contract:**
- Resolve the member only by normalized `JNUITS-2023001`.
- Require evidence of the last verified actual-service assignment and the immediately following published executive term with a trustworthy `starts_on`.
- Require absence from that successor roster and do nothing when prerequisites are missing or contradictory.
- Set alumni state/effective date only as an evidence-backed correction, preserve security state, and append one deduplicated lifecycle/audit event.

- [ ] **Step 1: Write a failing guarded-data-migration test**

  Assert no hardcoded UUID, no guessed date, exact identity scope, actual-service status check, successor-date derivation, absence check, security preservation, already-correct no-op, rerun safety, and an auditable correction event.

- [ ] **Step 2: Run the contract test and verify RED**

  Run: `npx vitest run --project node src/lib/committee/verified-alumni-correction-migration.test.ts`

  Expected: FAIL because the correction migration is absent.

- [ ] **Step 3: Implement the guarded correction**

  Derive the effective alumni date from the start of the committee immediately after the member's last verified EC service. If production evidence differs from the expected 2nd-5th service/6th absence history, abort or no-op and report for human review rather than forcing data.

- [ ] **Step 4: Replay and inspect the correction result**

  Run: `npm run db:replay-bootstrap`

  Run: `npx vitest run --project node src/lib/committee/verified-alumni-correction-migration.test.ts src/lib/committee/public-projection.test.ts`

  Expected: PASS with one identity-scoped event and unchanged portal security.

- [ ] **Step 5: Commit**

  Commit: `fix(data): correct verified ec alumni transition`

### Task 7: Committee finalization integration verification

**Files:**
- Modify only focused tests/docs for verified gaps; do not start the photo migration yet.

- [ ] **Step 1: Run focused committee suites**

  Run: `npx vitest run --project node src/lib/committee src/app/admin/committee`

  Run: `npm run test:dom -- src/components/admin/committee-member-search.dom.test.tsx src/components/admin/committee-assignment-form.dom.test.tsx src/components/admin/committee-finalization-panel.dom.test.tsx`

  Run: `npm run db:verify-committee-onboarding`

- [ ] **Step 2: Replay database and run repository gates**

  Run: `npm run db:replay-bootstrap`

  Run: `npm run typecheck`

  Run: `npm run lint`

  Run: `npm run test:node`

  Run: `npm run test:dom`

  Run: `npm run build`

  Run: `npm run audit:admin-access`

  Run: `npm run audit:admin-ui`

- [ ] **Step 3: Exercise transactional race scenarios**

  In disposable scratch data, create two previews, change one assignment/vacancy, verify the stale preview fails, finalize the fresh digest, retry it, verify one lifecycle event, verify ordinary edit rejection, reopen with a reason, and confirm alumni state is not reversed.

- [ ] **Step 4: Browser-test the full admin flow**

  At 375/768/1024/1440 in light/dark themes, search beyond the first member page, assign seats, mark an explained vacancy, inspect impact, finalize, observe lock, and reopen. Confirm keyboard/focus/screen-reader behavior and zero horizontal overflow.

- [ ] **Step 5: Review permission/privacy invariants**

  Confirm Content Admin cannot assign/finalize/reopen, preview DTOs contain no private contact data, no actor ID is trusted from the browser, and no finalized action changes `portal_access_status`.

- [ ] **Step 6: Commit verification-only corrections**

  Commit: `test(committee): verify atomic roster finalization`
