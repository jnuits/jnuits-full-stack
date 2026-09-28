# Committee Onboarding Phase 3: Public Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish every approved executive roster in configured order and provide privacy-safe committee profile pages for claimed, unclaimed, and frozen members.

**Architecture:** A pure projection layer converts explicitly selected committee/member rows into minimal public DTOs. A `server-only` data-access layer uses the Supabase service client only on the server, pages every result set, and never serializes database rows directly. The member profile route merges the existing directory-visible profile with a restricted committee fallback, while a shared invalidation helper refreshes committee and member routes after relevant writes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-23-committee-member-onboarding-design.md`

## Global Constraints

- Preserve the existing theme, header, committee tabs, and historical committee URLs.
- Display the current committee first, then prior committees by descending committee number.
- Position visibility and order come from `committee_term_positions`; never hardcode role exclusions.
- Order assignments by position priority, assignment order, then a deterministic ID tie-breaker.
- Display actual published totals and configured seats; never assume 21.
- Preserve the separate advisor workflow.
- A public appointment is independent of claim, login, lifecycle, and dashboard-access state.
- Return only approved name, photo/initials, position, department, committee data, approved public social data, and JnUITS ID. Never return email, phone, student ID, notes, invitation/claim state, or dashboard state.
- Keep `members` inaccessible to browser roles; privileged reads stay in `server-only` code.
- Batch and paginate reads; no N+1 queries or silent row caps.
- Revalidate committee and member profile routes after publication, approved identity/profile changes, lifecycle/access changes, and member photo changes.
- Do not add a database migration in Phase 3; consume the already-applied Phase 1/2 schema.

## Review Focus

- A public sub-executive or newly named role not present in legacy arrays still renders in exact configured priority order.
- More rows than one Supabase response page are fetched once each without duplication, omission, or an infinite loop.
- A frozen or unclaimed executive with a hidden ordinary directory profile still receives the restricted committee profile, with no private fields.
- A JnUITS ID change invalidates both the old route and the dynamic member-profile route so stale content cannot survive.
- Missing relations, duplicate public position labels, and equal priority/sort values produce deterministic output rather than dropping or reshuffling people.

---

### Task 1: Safe deterministic projection contracts

**Files:**
- Create: `src/lib/committee/public-contracts.ts`
- Create: `src/lib/committee/public-projection.ts`
- Test: `src/lib/committee/public-projection.test.ts`

**Interfaces:**
- Consumes: generated `Tables<>` shapes for committee terms, positions, roles, assignments, members, departments, and advisors.
- Produces: `PublicCommitteeAssignment`, `PublicCommitteeTerm`, `PublicAdvisorProfile`, `PublicCommitteeDirectory`, `PublicCommitteeMemberProfile`, and `projectPublicCommitteeDirectory(input: PublicCommitteeProjectionInput): PublicCommitteeDirectory`.

- [ ] **Step 1: Write failing projection tests**

  Cover public term/assignment/position gates; `advisor` exclusion with `sub_executive` inclusion; configured labels; position-priority + assignment-order + ID tie-breaking; configured seat sums with the stored term target as the only fallback; current-term selection without a hardcoded slug; one identity across several terms; exact output keys when input objects contain private fields; missing relations; equal priorities; and duplicate labels.

- [ ] **Step 2: Run the projection tests and verify RED**

  Run: `npx vitest run --project node src/lib/committee/public-projection.test.ts`

  Expected: FAIL because the contracts and projector do not exist.

- [ ] **Step 3: Implement the minimal pure projector**

  `projectPublicCommitteeDirectory` accepts arrays already loaded by the DAL. Include an assignment only when its term is public executive content, the assignment is public and not planned, and the matching term-position overlay is public and not `advisor`. Resolve label/group/priority/seats from the overlay, use global role data only for the canonical role code, and build every DTO field explicitly.

- [ ] **Step 4: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/committee/public-projection.test.ts && npm run typecheck`

  Expected: PASS with all projection cases and zero type errors.

- [ ] **Step 5: Commit**

  Commit: `feat(committee): add safe public projection contracts`

### Task 2: Server-only paginated committee data access

**Files:**
- Modify: `src/lib/committee/public.ts`
- Create: `src/lib/committee/public-data.test.ts`

**Interfaces:**
- Consumes: Task 1 `projectPublicCommitteeDirectory` and public DTO types.
- Produces: cached `getPublicCommitteeDirectory()`, `getPublicCommitteeTermByIdentifier(identifier: string)`, `resolveCommitteeAliasSlug(alias)`, `getPublicCommitteeMemberProfileByJnuitsId(jnuitsId: string)`, and `collectSupabasePages<T>(fetchPage, pageSize): Promise<T[]>`.

- [ ] **Step 1: Write failing DAL/pagination tests**

  Test multi-page collection, exact-page-boundary termination, database-error propagation, and source invariants: `import "server-only"`, `createAdminClient`, explicit select lists, no `createPublicClient`, no fixed `.limit(512)`, and no sensitive member columns.

- [ ] **Step 2: Run the DAL tests and verify RED**

  Run: `npx vitest run --project node src/lib/committee/public-data.test.ts`

  Expected: FAIL on the current anonymous, capped implementation.

- [ ] **Step 3: Replace the legacy loader**

  Page terms, term positions, assignments, and advisors in bounded batches through `createAdminClient()`. Select only the raw fields accepted by Task 1, throw safe server errors instead of silently returning empty data, project once, and cache per request with React `cache`. Member fallback lookup must search only the already-sanitized public directory DTO.

- [ ] **Step 4: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/committee/public-data.test.ts src/lib/committee/public-projection.test.ts && npm run typecheck`

  Expected: PASS; no server-only import reaches client runtime code.

- [ ] **Step 5: Commit**

  Commit: `feat(committee): load public rosters through server-only DAL`

### Task 3: Configured-order committee rendering

**Files:**
- Modify: `src/lib/committee-utils.ts`
- Create: `src/lib/committee-utils.test.ts`
- Modify: `src/components/committee/CommitteeTermSwitcher.tsx`
- Modify: `src/components/committee/CommitteeHero.tsx`
- Modify: `src/components/committee/CommitteePageClient.tsx`
- Modify: `src/components/committee/CurrentCommitteeSection.tsx`
- Modify: `src/components/committee/ExecutiveMemberCard.tsx`
- Modify: `src/app/(public)/committee/page.tsx`
- Modify: `src/app/(public)/committee/[termSlug]/page.tsx`

**Interfaces:**
- Consumes: Task 1 public DTOs, already sorted by configured position/assignment priority.
- Produces: `groupCommitteeAssignmentsByPosition(assignments): Array<{ key: string; label: string; assignments: PublicCommitteeAssignment[] }>` preserving first appearance and assignment order.

- [ ] **Step 1: Write failing render-order tests**

  Assert joint-secretary, sub-executive, and unknown future role codes remain visible; position groups preserve projector order; duplicate labels do not merge different roles; totals use `targetExecutiveSlots`; and no production committee component contains the literal fallback `21` or a role allow/deny array.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/lib/committee-utils.test.ts`

  Expected: FAIL because legacy grouping excludes sub-executives and detailed pages use hardcoded role arrays.

- [ ] **Step 3: Render dynamic ordered position groups**

  Import DTO types from `public-contracts.ts`, render sections from `groupCommitteeAssignmentsByPosition`, keep existing cards/tabs/styles, retain the exact term URLs and advisor sections, label estimated dates, and remove hardcoded current slug/seat/role fallbacks.

- [ ] **Step 4: Run focused tests, DOM tests, and typecheck**

  Run: `npx vitest run --project node src/lib/committee-utils.test.ts src/lib/committee/public-projection.test.ts && npm run test:dom && npm run typecheck`

  Expected: PASS with every configured role represented in stable order.

- [ ] **Step 5: Commit**

  Commit: `fix(committee): render configured public roster order`

### Task 4: Restricted committee member profile fallback

**Files:**
- Create: `src/lib/members/public-profile-contract.ts`
- Create: `src/lib/members/public-profile.ts`
- Create: `src/lib/members/public-profile.test.ts`
- Modify: `src/components/members/member-profile-card.tsx`
- Modify: `src/app/(public)/members/[jnuitsId]/page.tsx`

**Interfaces:**
- Consumes: existing `getPublicMemberByJnuitsId`, Task 2 `getPublicCommitteeMemberProfileByJnuitsId`.
- Produces: `PublicMemberProfile` discriminated by `scope: "directory" | "committee"`; `getPublicMemberProfileByJnuitsId(jnuitsId: string): Promise<PublicMemberProfile | null>`.

- [ ] **Step 1: Write failing profile-composition tests**

  Assert a directory-visible profile keeps its existing visibility-filtered fields and gains committee history; a hidden/frozen/unclaimed executive gets only name, JnUITS ID, photo, department, and public appointments; a person with no directory visibility and no public appointment returns `null`; private input keys never appear in either DTO.

- [ ] **Step 2: Run the profile tests and verify RED**

  Run: `npx vitest run --project node src/lib/members/public-profile.test.ts`

  Expected: FAIL because the fallback and union contract do not exist.

- [ ] **Step 3: Implement the profile composer and route integration**

  Keep ordinary directory rules unchanged. When ordinary access fails, return the restricted committee variant only if Task 2 found at least one approved appointment. Update the card to hide directory-only badge, workplace, and social sections for restricted profiles and add a Committee service section linking to each term.

- [ ] **Step 4: Run focused tests, DOM tests, and typecheck**

  Run: `npx vitest run --project node src/lib/members/public-profile.test.ts src/lib/members/directory.test.ts && npm run test:dom && npm run typecheck`

  Expected: PASS; restricted profiles contain no unapproved fields.

- [ ] **Step 5: Commit**

  Commit: `feat(members): add restricted committee profile fallback`

### Task 5: Public projection revalidation

**Files:**
- Create: `src/lib/committee/revalidation.ts`
- Create: `src/lib/committee/revalidation.test.ts`
- Modify: `src/app/admin/committee/actions.ts`
- Modify: `src/app/admin/onboarding/actions.ts`
- Modify: `src/app/admin/membership/actions.ts`
- Modify: `src/app/admin/membership/moderation-actions.ts`
- Modify: `src/app/api/profile/direct/route.ts`
- Modify: `src/app/api/profile/avatar/complete/route.ts`

**Interfaces:**
- Consumes: Next.js `revalidatePath` with a required type for route patterns.
- Produces: `revalidatePublicCommitteeProjection(): void`, invalidating `/committee`, `/committee/[termSlug]` as `page`, `/members`, and `/members/[jnuitsId]` as `page`.

- [ ] **Step 1: Write the failing invalidation test**

  Mock `next/cache` and assert all four invalidations, including the dynamic-route `page` argument. Add source assertions that successful committee mutations, onboarding publication (not draft editing), approved member profile/ID mutations, lifecycle/access changes, direct edits, and member avatar completion invoke the helper.

- [ ] **Step 2: Run the invalidation test and verify RED**

  Run: `npx vitest run --project node src/lib/committee/revalidation.test.ts`

  Expected: FAIL because only root list paths are currently invalidated.

- [ ] **Step 3: Add and wire the shared helper**

  Replace committee root-only invalidations with the helper. Call it only after successful writes. In avatar completion, call it only for `targetType === "member"`; admin-avatar changes remain unrelated.

- [ ] **Step 4: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/committee/revalidation.test.ts && npm run typecheck`

  Expected: PASS with all required routes covered.

- [ ] **Step 5: Commit**

  Commit: `fix(committee): revalidate public roster and profile routes`

### Task 6: Phase 3 integration verification

**Files:**
- Modify only if verification exposes a covered defect.

**Interfaces:**
- Consumes: Tasks 1–5 as one deployable Phase 3 branch.
- Produces: a reviewed, buildable branch with no migration or privileged-data regression.

- [ ] **Step 1: Run focused Phase 3 suites**

  Run: `npx vitest run --project node src/lib/committee/public-projection.test.ts src/lib/committee/public-data.test.ts src/lib/committee-utils.test.ts src/lib/members/public-profile.test.ts src/lib/committee/revalidation.test.ts`

  Expected: PASS.

- [ ] **Step 2: Run repository gates**

  Run: `npm run typecheck && npm run lint && npm run test:node && npm run test:dom && npm run audit:admin-access && npm run audit:admin-ui && npm run migration:check && npm run migration:check-order:strict && npx next build`

  Expected: all commands succeed; the build contains `/committee`, `/committee/[termSlug]`, and `/members/[jnuitsId]`.

- [ ] **Step 3: Review the complete diff**

  Check the branch against the spec for service-key containment, serialized keys, role/seat hardcoding, ordering, paging termination, error handling, privacy, cache invalidation, theme drift, PII/secrets, and accidental migration changes.

- [ ] **Step 4: Commit verification-only fixes, if any**

  Commit: `test(committee): verify public projection integration`

- [ ] **Step 5: Prepare merge handoff**

  Report exact test counts and remaining Phases 4–5. Do not merge, push, apply migrations, or deploy without the user’s explicit approval.
