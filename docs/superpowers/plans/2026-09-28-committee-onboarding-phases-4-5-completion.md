# Committee & Member Onboarding Phases 4–5 Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the approved onboarding master specification by proving imported-profile claiming and access controls, completing production browser verification, and publishing administrator-approved Committee 1–6 roster data.

**Architecture:** Extend the existing `member_invitations`, profile-claim, identity-review, lifecycle, and portal-authorization paths rather than introducing a second onboarding system. Keep public committee projection independent from authentication and dashboard access, and treat official roster publication as an audited production operation after code verification.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth/PostgreSQL/RLS/RPC, Resend, Vitest, Playwright, GitHub Actions, and Vercel.

**Spec:** `docs/superpowers/specs/2026-09-23-committee-member-onboarding-design.md`

## Current status (recorded 2026-09-28)

- Phases 1–3 are merged into `main` through PR #157.
- Production project `jnuits.org.bd` is `ACTIVE_HEALTHY`.
- `origin/main` and production Supabase both contain the same 101 migrations; the latest is `20260927014437_committee_onboarding_draft_publish`.
- The latest onboarding schema was verified in production: table/RLS, 20 expected columns, five RPC functions, nine indexes, three policies, and privilege boundaries all passed.
- Phase 4 has not received its dedicated implementation/review gate. Existing invitation, claim, identity-review, and lifecycle code must be audited and reused.
- Phase 5 is only partial: prior CI and migration replay passed, but the final claiming/access implementation still requires browser verification, production deployment verification, and live smoke tests.
- Complete Committee 1–6 publication cannot be claimed until administrators provide and approve official spreadsheets, historical priorities, verified dates, and the final publication preview.

## Global constraints

- Importing creates member rows only; it must not create passwords, auth users, sessions, or administrative privileges.
- Committee appointments never grant Admin or Content Admin permissions.
- Claim the imported member row; never create a duplicate or reset an existing auth account merely because the email matches.
- Preserve invitation recipient binding, expiry, single use, CAPTCHA, rate limiting, password validation, manual-code fallback, delivery failure visibility, and controlled retries.
- Official identity fields require administrator review; ordinary permitted profile fields continue through existing direct-edit controls.
- Dashboard access and public committee publication remain independent.
- Freezing must block protected portal and API use immediately, including an already-issued session; claiming must not reactivate a frozen member.
- Content Admin receives no new committee or membership permission.
- Preserve legacy records and the backup branch. Do not fabricate roster data or commit production PII, source spreadsheets, invitation codes, or credentials.
- Use the repository migrations as the only source of production DDL. Apply reviewed migrations before deploying dependent code.
- Supabase leaked-password protection remains a documented free-tier exception; retain application password validation, CAPTCHA, and rate limiting.

## Review focus

- A valid invitation for an imported but frozen member claims the existing row while leaving portal access blocked.
- A mismatched email, expired/reused code, or pre-existing conflicting auth account fails generically without exposing whether an account exists.
- Direct-edit APIs cannot change name, email, JnUITS ID, department, committee role/order, visibility, or appointment history.
- A lifecycle change invalidates access on the next protected request even when JWT claims or browser state are stale.
- Re-importing approved roster data is idempotent and never duplicates a member or `(term_id, role_id, member_id)` appointment.

---

## File structure

### Existing implementation to audit and extend

- `src/app/(auth)/actions.ts` — member claim orchestration and auth provisioning.
- `src/app/auth/confirm/route.ts` — verified-email claim finalization.
- `src/app/admin/invitations/actions.ts` — invitation issue, retry, revoke, and batch actions.
- `src/lib/admin/invitations.ts` — invitation persistence, Resend delivery, and audit records.
- `src/app/api/profile/direct/route.ts` — permitted direct member edits.
- `src/app/api/profile/change-requests/route.ts` — administrator-reviewed identity changes.
- `src/app/admin/membership/actions.ts` — member lifecycle and portal-access administration.
- `src/lib/portal/member.ts` — request-time portal access resolution.
- `src/lib/supabase/proxy.ts` — protected-route enforcement with current database claims.
- `src/app/admin/onboarding/actions.ts` and `src/lib/committee/onboarding/**` — imported draft validation and atomic publication.

### Planned verification files

- Create: `src/lib/committee/onboarding/claim-access-integration.test.ts`
- Create: `src/app/api/profile/direct/route.test.ts`
- Create: `src/app/api/profile/change-requests/route.test.ts`
- Create: `src/lib/portal/member.test.ts`
- Create: `e2e/committee-onboarding-claim.spec.ts`
- Create: `e2e/committee-public-rosters.spec.ts`
- Create only if the audit proves a database gap: `supabase/migrations/20260928090000_committee_profile_claim_access_hardening.sql`

## Task 1: Pin imported-profile claim invariants

**Files:**
- Create: `src/lib/committee/onboarding/claim-access-integration.test.ts`
- Modify: `src/lib/committee/onboarding/membership-admin-integration.test.ts`
- Modify as required by failing tests: `src/app/admin/onboarding/actions.ts`
- Modify as required by failing tests: `src/lib/committee/onboarding/draft-repository.ts`

**Interfaces:**
- Consumes: `commit_onboarding_draft(operation_id, expected_revision, make_current)` and the existing `members`/`member_invitations` model.
- Produces: a tested invariant that publication creates or updates only member/appointment data and leaves authentication and invitation issuance explicit.

- [ ] Write tests proving a committed import creates no auth user, session, invitation, or RBAC role and preserves `lifecycle_status` plus `portal_access_status`.
- [ ] Write tests proving replay is idempotent and matching never merges split identities.
- [ ] Run `npm run test:node -- src/lib/committee/onboarding/claim-access-integration.test.ts src/lib/committee/onboarding/membership-admin-integration.test.ts`; expect the new assertions to fail before any required patch.
- [ ] Make the minimum onboarding action/repository changes required by those tests; do not add invitation side effects to publication.
- [ ] Rerun the focused tests and `npm run db:verify-committee-onboarding`; expect all checks to pass.
- [ ] Commit with `test(onboarding): pin imported profile claim boundaries` or a scoped fix message if production code changed.

## Task 2: Complete invitation and claim integration

**Files:**
- Modify: `src/app/admin/invitations/actions.ts`
- Modify: `src/lib/admin/invitations.ts`
- Modify: `src/app/(auth)/actions.ts`
- Modify: `src/app/auth/confirm/route.ts`
- Test: `src/lib/admin/invitations.test.ts`
- Test: `src/app/auth/confirm/route.test.ts`
- Test: `src/lib/committee/onboarding/claim-access-integration.test.ts`

**Interfaces:**
- Consumes: `issueInvitationForMember(options)`, `claimProfile(formData)`, and `finalize_member_invitation_claim`.
- Produces: explicit invitation issuance for imported members, safe delivery retry/manual fallback, and claim finalization that binds the existing member without changing lifecycle state.

- [ ] Add failing tests for expiry, single use, recipient mismatch, existing-account conflict, Resend failure/retry, and the authorized manual-code fallback.
- [ ] Add a failing test proving a frozen imported member remains frozen after successful claim finalization.
- [ ] Run the focused invitation and confirm-route tests; expect the missing behaviors to fail.
- [ ] Patch only the failing paths, preserving generic public errors, audit records, CAPTCHA, rate limits, and password rules.
- [ ] Rerun focused tests plus `npm run test:node`; expect all to pass.
- [ ] Commit with `feat(onboarding): complete imported profile claiming`.

## Task 3: Enforce profile ownership and immediate freeze boundaries

**Files:**
- Create: `src/app/api/profile/direct/route.test.ts`
- Create: `src/app/api/profile/change-requests/route.test.ts`
- Create: `src/lib/portal/member.test.ts`
- Modify: `src/app/api/profile/direct/route.ts`
- Modify: `src/app/api/profile/change-requests/route.ts`
- Modify: `src/app/admin/membership/actions.ts`
- Modify: `src/lib/portal/member.ts`
- Modify: `src/lib/supabase/proxy.ts`
- Create only if required: `supabase/migrations/20260928090000_committee_profile_claim_access_hardening.sql`
- Regenerate if migration changes types: `src/lib/db/types.ts`

**Interfaces:**
- Consumes: `set_member_lifecycle_status`, `profile_update_requests`, `getPortalMemberSnapshot(userId)`, and request-time database claim resolution.
- Produces: server-enforced field ownership and request-time access denial for frozen/deactivated members without changing public committee projection.

- [ ] Add failing API tests that ordinary direct edits accept only permitted contact/social/photo fields and reject official identity or committee fields.
- [ ] Add failing identity-request tests for reviewed name, email, JnUITS ID, and department changes with audit metadata.
- [ ] Add failing portal/proxy tests proving a lifecycle freeze blocks pages and protected APIs with stale JWT claims, while public committee routes remain readable.
- [ ] Add a failing test proving unfreeze does not change appointment history or public visibility and Content Admin cannot perform membership/committee mutations.
- [ ] Patch the route, action, and access resolver boundaries. Add a migration only if PostgreSQL grants/RPC behavior cannot satisfy the tests as currently defined.
- [ ] Run the focused tests, `npm run typecheck`, `npm run lint`, `npm run audit:admin-access`, and migration checks; expect all to pass.
- [ ] If a migration was created, replay the full migration chain and regenerate/check `src/lib/db/types.ts` before committing.
- [ ] Commit with `fix(onboarding): enforce claim and freeze boundaries`.

## Task 4: Run the Phase 4 functional review gate

**Files:**
- Create: `e2e/committee-onboarding-claim.spec.ts`
- Modify only for testability: existing claim, invitation, membership, and portal components.

**Interfaces:**
- Consumes: the completed invitation, claim, identity-review, and freeze flows from Tasks 1–3.
- Produces: browser-level proof that Phase 4 satisfies the master specification.

- [ ] Create synthetic fixtures for an unclaimed active member, an unclaimed frozen executive, a claimed active member, and a conflicting identity; never use production PII.
- [ ] Test administrator invitation issuance, failed delivery visibility, controlled retry/manual fallback, successful claim, recipient mismatch, expiry, reuse, and existing-account conflict.
- [ ] Test that the frozen executive remains publicly visible but cannot access or mutate the portal after claim.
- [ ] Test identity-review routing and verify committee position/order/visibility are absent from member-edit controls.
- [ ] Run `npm run test:e2e -- e2e/committee-onboarding-claim.spec.ts`; expect all scenarios to pass on mobile and desktop projects used by the repository matrix.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run audit:admin-access`, `npm run migration:check`, and `npm run migration:check-order:strict`.
- [ ] Review the full diff for permission expansion, PII/secrets, theme changes, data loss, and duplicate onboarding logic.
- [ ] Commit with `test(onboarding): verify profile claiming and access controls`.

## Task 5: Rehearse and approve Committee 1–6 roster publication

**Files:**
- Create: `e2e/committee-public-rosters.spec.ts`
- Use outside Git: administrator-provided CSV/XLSX sheets and publication evidence containing PII.
- Do not modify seed data or commit official source spreadsheets merely to complete this task.

**Interfaces:**
- Consumes: the shared intake/draft workspace, term positions, atomic commit RPC, and server-only public projection.
- Produces: administrator-approved production rosters for committees 1–6 and a non-sensitive verification record.

- [ ] Obtain official spreadsheets, position priorities, dates, and administrator confirmation for all six committees.
- [ ] Import each sheet as a saved draft; review normalized values, conflicts, blanks, Bengali text, leading zeros, seat limits, and excluded rows before publication.
- [ ] Re-import the same approved data in a disposable environment and prove zero duplicate members or appointments.
- [ ] Obtain explicit administrator approval for each publication preview; do not publish inferred or synthetic values.
- [ ] Publish in controlled batches and verify counts, ordering, claimed/unclaimed/frozen visibility, historical URLs, and profile fallbacks.
- [ ] Run `e2e/committee-public-rosters.spec.ts` against the approved environment and record only non-sensitive evidence.
- [ ] Confirm removing an appointment does not delete the member/auth account and switching the current term does not rewrite history.

## Task 6: Complete Phase 5 production rollout

**Files:**
- Modify only as failures require: `e2e/committee-onboarding-claim.spec.ts`, `e2e/committee-public-rosters.spec.ts`, `e2e/smoke.spec.ts`, and production code owned by the failing behavior.

**Interfaces:**
- Consumes: all completed Phase 4 code and the administrator-approved roster publication from Task 5.
- Produces: traceable CI, Supabase, Vercel, and live-browser evidence for the exact production commit.

- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run audit:admin-access`, `npm run audit:admin-ui`, `npm run migration:check`, `npm run migration:check-order:strict`, `npm run build`, and the Playwright matrix.
- [ ] Verify a clean disposable replay of every migration and compare repository migration versions/names with production through the Supabase plugin.
- [ ] Apply only reviewed pending migrations through Supabase migration tooling, then verify schema objects, generated-type parity, and security/performance advisors.
- [ ] Record the free-tier leaked-password-protection warning as an accepted exception and verify application-side password validation, CAPTCHA, and claim rate limiting.
- [ ] Open a PR, require every GitHub check except the separately handled Vercel deployment check, review the diff, and merge only after the checks pass.
- [ ] Deploy the exact merged commit through the authorized `jnuits` GitHub/Vercel path and verify Vercel reports that commit as production-ready.
- [ ] Run live smoke tests for `/committee`, every historical term URL, executive profiles, admin onboarding, invitation claim, frozen portal denial, and identity-review submission at mobile/tablet/desktop widths.
- [ ] Confirm no source spreadsheets, production PII, invitation codes, passwords, snapshots, or credentials entered Git history.
- [ ] Mark the master specification complete only after Tasks 1–6 and administrator roster approval are evidenced.

## Deferred completion checklist

- [ ] Phase 4 dedicated implementation/review gate passed.
- [ ] Official Committee 1–6 data supplied and approved.
- [ ] Idempotent rehearsal passed before production publication.
- [ ] Phase 5 browser and accessibility matrix passed.
- [ ] GitHub Actions passed for the final merge commit.
- [ ] Supabase production migration/schema parity verified.
- [ ] Exact Vercel production commit and live smoke tests verified.
- [ ] Non-sensitive handoff evidence recorded and the master specification status updated.
