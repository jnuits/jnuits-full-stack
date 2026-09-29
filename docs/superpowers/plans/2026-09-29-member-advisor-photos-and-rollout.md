# Member and Advisor Photos plus Production Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the program by giving membership and committee administrators secure canonical photo management for members/advisors, rendering those photos everywhere they belong, and releasing all approved intake, lifecycle, and committee-finalization migrations/code with end-to-end evidence.

**Architecture:** Extend the existing signed Cloudinary avatar pipeline with one advisor target and mount the existing member target in Membership DB. Stable public IDs overwrite one optimized 400x400 asset, while validated metadata remains on the canonical member/advisor row. Committee assignments reference identity only and read canonical photos. Release proceeds additive-migrations-first, then code, with scratch replay, production migration verification, Supabase advisors, CI, deployment, and smoke tests.

**Tech Stack:** Next.js 16 Route Handlers and App Router, React 19, TypeScript, Cloudinary signed uploads, Supabase/PostgreSQL, Vitest, React Testing Library, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-29-membership-lifecycle-committee-finalization-design.md`

## Global Constraints

- Execute after the other three 2026-09-29 plans have passed their focused and integration gates.
- Before modifying avatar Route Handlers, caches, or revalidation, read the local Next.js 16 Route Handler, caching, revalidation, and `revalidatePath` guides under `node_modules/next/dist/docs/`.
- Reuse `AvatarUploadField`, signed upload authorization, byte/format/dimension checks, and Cloudinary configuration. Do not create a parallel uploader.
- Stable IDs are exactly `jnuits/member-avatars/{memberId}/avatar` and `jnuits/advisor-avatars/{advisorId}/avatar`.
- Store only verified optimized asset metadata. Never accept a browser-supplied secure URL as proof of an uploaded asset.
- Committee assignments never store/copy an avatar URL. Member cards always read `members.avatar_secure_url`; advisor cards read `advisor_profiles.avatar_secure_url`.
- Members may update their own mutable profile; membership administrators may update claimed/unclaimed members; advisor upload requires `admin.committee.manage`.
- An advisor must exist before upload. The ordinary advisor form must not retain a raw arbitrary avatar-URL input.
- Keep initials as an accessible fallback and ensure an image plus fallback never renders duplicate initials.
- Use the Supabase skill/plugin for migration verification/application/advisors and the existing GitHub/Vercel workflow for release. Do not claim remote success without reading remote evidence.
- Apply reviewed additive migrations before deploying code that requires them. Never rewrite an applied migration; forward-fix if production differs.

## Review Focus

- Membership administrators can replace a claimed or unclaimed member photo without changing lifecycle, roles, privacy, or auth state.
- Advisor upload authorization, stable Cloudinary path, exact 400x400 metadata, overwrite/invalidation, and raw-URL removal are enforced server-side.
- The same canonical member photo appears in Membership DB, portal, every historical/current committee card, and public member projection without copied URLs.
- Missing/broken images fall back to one accessible set of initials with stable layout at all target widths/themes.
- Production Supabase migrations, advisors, GitHub checks, deployed commit, and browser smoke tests are independently verified before completion is claimed.

---

### Task 1: Advisor avatar metadata migration

**Files:**
- Create: `supabase/migrations/20260929140000_advisor_avatar_metadata.sql`
- Create: `src/lib/profile/advisor-avatar-migration.test.ts`
- Modify: `src/lib/db/types.ts` (generated only)
- Modify: `src/lib/committee/onboarding/generated-db-types.test.ts`

**Database contract:**
- Preserve existing `advisor_profiles.avatar_public_id` and `avatar_secure_url`.
- Add `avatar_format`, `avatar_bytes`, `avatar_width`, `avatar_height`, `avatar_updated_at`, and `avatar_updated_by_user_id` with the same safe checks/FK behavior as members.
- Existing URLs remain readable; new/updated photos must satisfy the signed completion route.

- [ ] **Step 1: Write a failing migration contract test**

  Assert additive columns, exact 400x400 paired dimensions, non-negative bytes, actor FK, no member/assignment URL columns, no existing URL deletion, and unchanged advisor RLS/permissions.

- [ ] **Step 2: Run the contract test and verify RED**

  Run: `npx vitest run --project node src/lib/profile/advisor-avatar-migration.test.ts`

  Expected: FAIL because metadata columns are missing.

- [ ] **Step 3: Implement the additive migration**

  Match member avatar constraints and triggers without fabricating metadata for legacy URLs. Leave legacy URL-only rows usable until an administrator replaces them through the signed flow.

- [ ] **Step 4: Replay and regenerate types**

  Run: `npm run db:replay-bootstrap`

  Run: `npm run db:types:generate`

  Run: `npx vitest run --project node src/lib/profile/advisor-avatar-migration.test.ts src/lib/committee/onboarding/generated-db-types.test.ts`

  Expected: PASS with generated advisor metadata types.

- [ ] **Step 5: Commit**

  Commit: `feat(db): add advisor avatar metadata`

### Task 2: Extend signed avatar authorization and completion to advisors

**Files:**
- Modify: `src/lib/profile/avatar-access.ts`
- Create: `src/lib/profile/avatar-access.test.ts`
- Modify: `src/app/api/profile/avatar/sign/route.ts`
- Create: `src/app/api/profile/avatar/sign/route.test.ts`
- Modify: `src/app/api/profile/avatar/complete/route.ts`
- Create: `src/app/api/profile/avatar/complete/route.test.ts`
- Modify: `src/lib/committee/revalidation.ts`
- Modify: `src/lib/committee/revalidation.test.ts`

**Interfaces:**
- Extend `AvatarTargetType` to `"admin_profile" | "member" | "advisor"`.
- `buildAvatarPublicId("advisor", id)` returns `jnuits/advisor-avatars/{id}/avatar`.
- `authorizeAvatarTarget` loads the advisor, requires `admin.committee.manage`, and returns its linked user only as an audit target.
- Completion chooses the canonical table through an exhaustive target map, not a two-way conditional.

- [ ] **Step 1: Write failing authorization tests**

  Cover anonymous, member-only, Content Admin, committee manager, super admin, missing advisor, stable ID, and inability to spoof another target type/ID.

- [ ] **Step 2: Write failing Route Handler tests**

  Cover Zod target enum, exact signed public ID, allowed type/format/bytes/dimensions, Cloudinary resource verification, exhaustive table/event mapping, metadata save, overwrite/invalidate parameters, safe errors, and committee/advisor revalidation.

- [ ] **Step 3: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/lib/profile/avatar-access.test.ts src/app/api/profile/avatar/sign/route.test.ts src/app/api/profile/avatar/complete/route.test.ts src/lib/committee/revalidation.test.ts`

  Expected: FAIL because advisor is not an accepted target.

- [ ] **Step 4: Implement advisor target through the existing pipeline**

  Keep all current member/admin-profile protections. Update security-event names and target table mapping explicitly. Revalidate public committee data, relevant term/member/advisor routes, and the admin Committee workspace after successful completion only.

- [ ] **Step 5: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/profile/avatar-access.test.ts src/app/api/profile/avatar/sign/route.test.ts src/app/api/profile/avatar/complete/route.test.ts src/lib/committee/revalidation.test.ts`

  Run: `npm run typecheck`

- [ ] **Step 6: Commit**

  Commit: `feat(profile): support signed advisor avatars`

### Task 3: Mount canonical photo management in Membership DB

**Files:**
- Modify: `src/app/admin/membership/profile-actions.ts`
- Modify: `src/app/admin/membership/profile-actions.test.ts`
- Modify: `src/components/admin/member-profile-editor.tsx`
- Create: `src/components/admin/member-profile-editor.dom.test.tsx`
- Modify: `src/app/admin/membership/page.tsx`
- Modify: `src/components/profile/avatar-upload-field.tsx` only for reusable labeling/callback behavior proven necessary by tests
- Create: `src/components/profile/avatar-upload-field.dom.test.tsx` if reusable behavior changes

**Interfaces:**
- Extend `MemberProfileActionMember` with `avatarSecureUrl` and required display identity.
- Render `AvatarUploadField targetType="member"` for saved member IDs, including unclaimed members.
- On completion, update local preview and refresh canonical server data; no direct URL text input.

- [ ] **Step 1: Write failing action/DOM tests**

  Prove member profile load returns canonical avatar; membership permission can upload for claimed/unclaimed members; unrelated lifecycle/access/role/privacy fields are untouched; current image or initials render once; completion updates preview; and missing member ID cannot sign/upload.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/app/admin/membership/profile-actions.test.ts`

  Run: `npm run test:dom -- src/components/admin/member-profile-editor.dom.test.tsx`

  Expected: FAIL because the editor does not expose the existing uploader.

- [ ] **Step 3: Add the uploader without changing profile-save semantics**

  Keep photo upload separate from text-form submission, use existing accessible progress/error messages, and show the stable 400x400 crop guidance.

- [ ] **Step 4: Run focused tests, UI audit, and typecheck**

  Run: `npx vitest run --project node src/app/admin/membership/profile-actions.test.ts`

  Run: `npm run test:dom -- src/components/admin/member-profile-editor.dom.test.tsx src/components/profile/avatar-upload-field.dom.test.tsx`

  Run: `npm run audit:admin-ui`

  Run: `npm run typecheck`

- [ ] **Step 5: Commit**

  Commit: `feat(admin): manage canonical member photos`

### Task 4: Replace advisor raw URL editing with signed upload

**Files:**
- Modify: `src/components/admin/committee-workspace-client.tsx`
- Create: `src/components/admin/advisor-profile-form.dom.test.tsx`
- Modify: `src/app/admin/committee/actions.ts`
- Create: `src/app/admin/committee/actions.advisor.test.ts`
- Modify: `src/app/admin/committee/page.tsx`

**Interfaces:**
- Remove ordinary `avatarSecureUrl` form input/hidden URL mutation from `AdvisorForm` and `saveAdvisorProfile`.
- For a new advisor, save identity first and then render `AvatarUploadField targetType="advisor"` with the returned/stable advisor ID.
- Existing canonical/legacy image renders as preview until replaced.

- [ ] **Step 1: Write failing action tests**

  Assert `saveAdvisorProfile` ignores/rejects browser avatar URL fields, never overwrites avatar metadata during ordinary text edits, requires committee permission, returns the saved advisor ID, and retains existing photo values.

- [ ] **Step 2: Write failing DOM tests**

  Assert no raw URL control, clear save-first guidance for new advisors, signed uploader after save, preview/fallback once, replacement progress/errors, and existing-theme responsiveness.

- [ ] **Step 3: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/app/admin/committee/actions.advisor.test.ts`

  Run: `npm run test:dom -- src/components/admin/advisor-profile-form.dom.test.tsx`

  Expected: FAIL because the form still edits raw URLs.

- [ ] **Step 4: Implement save-then-upload advisor flow**

  Keep existing advisor identity/history fields intact. Use the signed route from Task 2 and refresh Committee/public advisor projections after completion.

- [ ] **Step 5: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/app/admin/committee/actions.advisor.test.ts`

  Run: `npm run test:dom -- src/components/admin/advisor-profile-form.dom.test.tsx`

  Run: `npm run typecheck`

- [ ] **Step 6: Commit**

  Commit: `feat(committee): secure advisor photo updates`

### Task 5: Render canonical photos in admin and public committee views

**Files:**
- Modify: `src/app/admin/committee/page.tsx`
- Modify: `src/components/admin/committee-workspace-client.tsx`
- Create: `src/components/admin/committee-avatar.dom.test.tsx`
- Modify: `src/lib/committee/public.ts`
- Modify: `src/lib/committee/public-projection.ts`
- Modify: `src/lib/committee/public-projection.test.ts`
- Modify: `src/components/members/member-avatar.tsx`
- Modify or create focused public committee DOM tests for the affected cards

**Interfaces:**
- Include `members.avatar_secure_url` in explicit admin assignment relation selects and map it to `memberAvatarSecureUrl`.
- Admin `AvatarToken` accepts optional canonical image URL and one initials fallback.
- Public projection reads only canonical member/advisor photo columns and never an assignment photo field.

- [ ] **Step 1: Write failing projection/query/DOM tests**

  Prove JNUITS-2023001's canonical member photo appears in every linked committee assignment; replacing one member URL changes all projected appearances; no assignment DTO/table photo field exists; advisor photos use advisor canonical data; and broken/missing images render one labeled fallback.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/lib/committee/public-projection.test.ts src/lib/committee/public-data.test.ts`

  Run: `npm run test:dom -- src/components/admin/committee-avatar.dom.test.tsx`

  Expected: FAIL because admin assignment queries/tokens omit member avatars.

- [ ] **Step 3: Implement canonical rendering**

  Add explicit select/mapping fields, reuse the existing optimized image/fallback component where possible, and keep alt text/context appropriate. Do not write image URLs into committee assignments.

- [ ] **Step 4: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/committee/public-projection.test.ts src/lib/committee/public-data.test.ts`

  Run: `npm run test:dom -- src/components/admin/committee-avatar.dom.test.tsx`

  Run: `npm run typecheck`

- [ ] **Step 5: Commit**

  Commit: `fix(committee): render canonical profile photos`

### Task 6: Program-wide local verification and release candidate review

**Files:**
- Modify only focused tests/docs/scripts when evidence shows a gap.

- [ ] **Step 1: Run all focused suites from the four plans**

  Run intake/catalog, renewal/departure, committee-finalization, avatar Route Handler, projection, action, and DOM tests named in the preceding plans. Record commands and results in the PR description.

- [ ] **Step 2: Run complete repository gates**

  Run: `npm run typecheck`

  Run: `npm run lint`

  Run: `npm run test:node`

  Run: `npm run test:dom`

  Run: `npm run build`

  Run: `npm run audit:admin-access`

  Run: `npm run audit:admin-ui`

  Run: `npm run db:verify-committee-onboarding`

  Run all migration integrity/order/runtime, static/secret, and committed-credential checks defined by `package.json` and `.github/workflows/quality-gate.yml`.

- [ ] **Step 3: Run clean database replay and generated-type drift check**

  Run: `npm run db:replay-bootstrap`

  Run: `npm run db:types:generate`

  Run: `git diff --exit-code -- src/lib/db/types.ts` after committing the intended generated type update.

  Expected: clean replay and no uncommitted generated drift.

- [ ] **Step 4: Browser-test all touched workflows**

  At 375/768/1024/1440 CSS pixels in light/dark themes, verify Membership import/manual edit/photo, grace/former/departure/appeal portal, Committee assignment/vacancy/finalization/reopen, and advisor photo upload. Confirm keyboard navigation, visible focus, screen-reader names, stable images/fallbacks, and zero horizontal overflow.

- [ ] **Step 5: Review the complete branch diff**

  Check data-loss risk, RLS/function grants, SSRF, action ownership, Cloudinary signature/completion, private DTO fields, stale-write behavior, migration order, generated types, secrets/PII, and accidental theme changes. Preserve unrelated user files and the pre-existing untracked 2026-09-28 plan.

- [ ] **Step 6: Commit verification-only corrections**

  Commit: `test(platform): verify membership and committee program`

### Task 7: Supabase production migration rollout

**Files:**
- No new application behavior; only forward-fix migration/tests if remote evidence finds a real incompatibility.

- [ ] **Step 1: Establish remote preflight evidence**

  With the connected Supabase project, read the project identity, applied migration list, relevant current schema/functions/grants, Cron availability, and current counts. Confirm the four planned migration versions plus guarded correction are pending in exact order. Do not use old recorded counts as assumptions.

- [ ] **Step 2: Run rollback-only production-schema validation**

  Follow the repository's documented production-schema verification procedure against a disposable database/schema snapshot. Confirm additive migrations can apply before the new code and old production code remains compatible.

- [ ] **Step 3: Apply reviewed migrations in order**

  Apply only:

  1. `20260929110000_member_intake_catalog.sql`
  2. `20260929120000_membership_anniversary_lifecycle.sql`
  3. `20260929130000_committee_roster_finalization.sql`
  4. `20260929131000_correct_verified_ec_alumni_transition.sql`
  5. `20260929140000_advisor_avatar_metadata.sql`

  Stop on any drift/error; do not edit an applied migration. Create a new forward-fix migration only after root-cause review and focused tests.

- [ ] **Step 4: Verify remote database state**

  Re-read migration history, columns/constraints/indexes/functions/grants, Cron job uniqueness, department code completeness/uniqueness, unknown joining-date correction queue, renewal ledger emptiness/expected state, roster finalization metadata, guarded JNUITS-2023001 result, and advisor avatar columns.

- [ ] **Step 5: Run Supabase security and performance advisors**

  Resolve new actionable findings caused by these migrations. Record known pre-existing or plan-tier-only findings separately; do not claim they are fixed.

- [ ] **Step 6: Record rollout evidence**

  Add migration/advisor evidence to the PR or release note without exposing secrets, member PII, request payloads, or payment references.

### Task 8: GitHub, deployment, and production smoke verification

**Files:**
- No code changes unless a verified release defect requires a new tested commit.

- [ ] **Step 1: Push the reviewed branch and open/update one PR**

  Include spec links, all four plan links, migration order, test evidence, security review, browser matrix, data-correction guard, and rollback/forward-fix notes. Attach the PR to the Codex task.

- [ ] **Step 2: Verify GitHub checks**

  Wait for every required non-Vercel quality/security/migration check to pass. Treat Vercel according to the repository's current ownership/plan limitation and the user's explicit deployment instruction; never describe an expected ownership failure as a code pass.

- [ ] **Step 3: Merge only the verified PR**

  Rebase/update against current `main`, rerun affected checks if the head changes, merge through the repository's accepted method, verify `origin/main` contains the merge, and delete only the completed feature branch after merge confirmation.

- [ ] **Step 4: Verify production deployment commit**

  Confirm Vercel production is built from the expected `origin/main` commit. If the hobby-plan author restriction requires the owner-trigger README update previously agreed with the user, stop and request that exact owner action rather than fabricating a deployment.

- [ ] **Step 5: Run privacy-safe production smoke tests**

  Verify public Committee current/history ordering and photos; admin Membership template/sample downloads and Sheet host rejection; former portal routing using an approved test account; Committee finalization preview without executing an unapproved real finalization; member/advisor signed photo flow with approved test records; and absence of horizontal overflow/console errors.

- [ ] **Step 6: Reconfirm production Supabase and close out**

  Re-read production migration list/Cron/advisors after deployment, confirm no failed lifecycle job or duplicate event, and report exact commit, PR, deployment, migration versions, checks, smoke results, and any deliberately deferred correction queue. Do not mark complete while any required evidence is unknown.
