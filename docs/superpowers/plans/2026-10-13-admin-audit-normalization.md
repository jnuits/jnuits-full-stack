# Admin Audit Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Preserve the owner’s existing native execution preference; use one focused review of this new delta, with no repeated review of the preceding release.

**Goal:** Fix verified admin authorization, data-preservation and interaction problems while retaining existing permissions and working workflows.

**Architecture:** Add checks close to existing privileged reads, preserve distinct management and self-service views, and repair existing editor contracts. Reuse established form, media, confirmation and navigation primitives. Avoid wholesale route/queue/import replacements or new database abstractions.

**Tech Stack:** Next.js16.3.8 App Router, React, TypeScript, Supabase, Vitest and Playwright.

**Spec:** [Validated findings and repair decisions](../../operations/2026-10-13-admin-audit-triage.md). The owner approved this scope and plan on 2026-10-13.

## Global Constraints

- Base: `59152c0ae4afcf830b45a6b8828db1382d1bcdf9`; branch: `codex/admin-audit-normalization`; worktree: `C:/Users/redwan/.codex/worktrees/committee-admin-handover/jnuits-full-stack`.
- Keep granular `cms.*` and `admin.*` permission codes; never invent `admin.content.manage` or silently broaden a role.
- Public forms/login keep Turnstile; no CAPTCHA inside authenticated dashboards. Preserve session, lifecycle, origin and rate-limit protection.
- Admin-role changes retain native AAL2 plus native current password and exact session/intent-bound proof. Optional enforcement for ordinary membership work is unchanged.
- Preserve existing URLs, exports, filters, import histories, operations, native confirmations and all functioning profile fields.
- Preserve released JnUITS styling, canonical/legacy department values and input/select height fixes. Leave public committee source guards and projections untouched.
- No production data or real-account mutations for testing. Use disposable fixtures; do not print credentials or secrets.
- No new SQL, provider billing upgrade, recurring AI follow-up or unrequested branch/worktree cleanup.

## Review Focus

1. A child route rendered after client navigation must deny privileged reads before a service-role query; Task1 pins this behavior.
2. A self-profile bookmark with forged target/query values must remain self-only; Task2 tests denial and scoped reads.
3. A cover absent from the current media page, zero developer sort order, and optional project fields must survive an ordinary save; Task3 tests preservation.
4. A stale singleton form must not overwrite another editor’s slider/body changes; Task5 tests conflicts and owned-key preservation.
5. An obsolete actor ID or restricted-role navigation must remain usable without disclosing additional profiles; Tasks2/6 test both cases.

---

### Task 1: Authorize admin reads at their entry points

**Files:** Modify all `src/app/admin/content/**/page.tsx` entry points that lack local authorization; `src/app/admin/{workplace,decisions,reconcile,reports,committee,certificates,invitations,profile-changes,audit}/page.tsx`; and the dashboard reader in `src/app/admin/page.tsx` where needed. Extend `src/lib/admin/access.test.ts`; create `src/app/admin/admin-page-authorization.test.ts`.

**Interfaces:** Consume existing `requireAdminPermission(permission, options)`, `requireAdminUser(options)` and route map. Keep the map’s exact permission and optional-enforcement semantics; do not add a blanket content layout guard.

- [ ] Write parameterized denial tests calling the actual page functions with mocked authorization rejection; assert no service-role client/query or privileged loader runs. Cover CMS areas, membership, history, reporting and representative nested routes.
- [ ] Run those tests and confirm the unguarded entry points fail the assertion.
- [ ] Add each existing route’s named permission check before privileged work. Dashboard/self-service paths keep their existing active-admin requirement. Verify related server actions already check their own permissions and preserve them.
- [ ] Verify authorized narrow roles retain their own area; test enforcement enabled/disabled, invalid/stale session and unavailable policy through existing guard tests. Run focused authorization tests, typecheck and access audit; commit the independently testable change.

### Task 2: Separate self-service presentation from admin management

**Files:** `src/lib/admin/access.ts`, `src/app/admin/layout.tsx`, `src/app/admin/settings/profile/page.tsx`, `src/app/admin/admin-profiles/page.tsx`, `src/lib/admin/admin-profiles.ts`; focused tests beside these modules.

**Interfaces:** Preserve `getAdminRouteAccess(pathname)` and existing directory DTO/action contracts. Add an explicit self/management read scope to `loadAdminProfileDirectory` while preserving existing management callers. Self reads derive and verify the authenticated actor; a requested profile ID never defines that actor.

- [ ] Write failing tests: every active admin can reach My Profile; nonmanagers cannot load the directory or management tabs; self reads select only the actor’s profile/roles/linked record/activity; malicious self queries do not read another identity.
- [ ] Add My Profile navigation and the canonical self route; show Admin Accounts only with `admin.admin_profiles.manage`. Preserve `/admin/admin-profiles?tab=self&profile=me` without authorizing management. Preserve the proxy’s trusted return-path overwrite.
- [ ] Scope the existing data loader before queries and reuse existing profile rendering. Hide global directory metrics/invitations/management tabs from self presentation. Keep management’s distinct role-change permissions and proof requirements.
- [ ] Run focused directory/navigation/assurance tests and a disposable restricted-role browser scenario including legacy self navigation and role-change denial; commit.

### Task 3: Repair Projects and shared cover selection

**Files:** `src/app/admin/content/projects/page.tsx`, `src/app/admin/content/actions.ts`, new `src/components/admin/project-editor.tsx`, `src/components/admin/blog-media-select.tsx` if its primitive needs compatible options, and project editor/action tests.

**Interfaces:** `ProjectEditor` consumes `ProjectSummary | null`, image media options and a server-verified upload capability. It submits the actual `projectFormSchema` field names to existing `createProject`/`updateProject`; project covers use `coverImageUrl`, not an invented table column. Optional shared-picker props preserve current blog output names and behavior by default.

- [ ] Write failing save/render tests for existing cover URL, tagline, category, dates, featured state and active/completed status; record switching must reset uncontrolled state. Test developer sort order0. A cover outside the latest media window must remain unchanged unless explicitly replaced/cleared.
- [ ] Replace ignored project sort/media controls with actual supported fields and statuses. Preserve stable existing slugs (creation keeps slug entry); key editors by selected record. Use nullish defaults for genuine developer sort order.
- [ ] Adapt the visual picker’s explicit selection/upload events to the project cover URL without mount-time clearing. Show upload only with `cms.media.manage`; server endpoints keep their own guards. Keep manual legacy URL preservation and allow explicit clear.
- [ ] Verify valid schema/payloads and permission failures before mutation; run project and existing blog-media tests, typecheck and disposable create/edit/clear/switch scenarios; commit.

### Task 4: Correct advisor actions and request badges

**Files:** `src/components/admin/committee-workspace-client.tsx`, `src/app/admin/committee/actions.ts`, `src/components/admin/admin-shell.tsx`, `src/lib/admin/access.ts`, `src/app/admin/profile-changes/page.tsx`; focused advisor DOM/action and badge tests. Create `src/lib/admin/profile-request-types.ts` for the one shared identity queue definition.

**Interfaces:** Advisor editor takes `initialTab: "profile" | "access"`; its identity/reset key includes the advisor and requested tab. Profile saves preserve the database’s current `user_id`; `linkAdvisorAuthUser` remains the linking interface. Export `IDENTITY_PROFILE_REQUEST_TYPES` as the readonly profile_change/email_change/jnuits_id_change set.

- [ ] Write failing menu tests: Edit opens Profile, Invite/link opens Access, public view is a real published-section link. Save after a link change must not clear/reassign that link; creation must not link a posted arbitrary UUID through the profile action.
- [ ] Implement distinct actions, keyed tab initialization and truthful current/former public targets. Remove the editable Auth UUID; use server-owned link preservation in profile saves. Retain all other profile/tenure/department/visibility fields and current linking capabilities.
- [ ] Write/implement badge tests for mixed identity/workplace/account requests and unavailable counts. Share the identity request set and remove unused badge keys/queries. Retain accurate legacy workplace/account links and the existing direct-update policy.
- [ ] Run advisor, committee source-guard, queue/badge tests and disposable browser interaction checks; commit.

### Task 5: Preserve singleton content and improve content discovery

**Files:** `src/components/admin/page-singleton-editor.tsx`, `src/app/admin/content/pages/page.tsx`, `src/app/admin/content/actions.ts`, `src/app/admin/content/page.tsx`; new `src/lib/content/singleton-edit-policy.ts` plus editor/action/policy tests.

**Interfaces:** `buildSingletonBodyUpdate(slug, currentBody, submittedBody)` updates only that editor’s owned fields and retains unrelated server content. Add `expectedUpdatedAt` to the page-save contract; compare-and-swap existing rows, insert new rows without an upsert overwrite race. About’s advanced editor changes metadata only and keeps its dedicated body editor.

- [ ] Write failing tests proving Home slider/stat/unrecognized keys and nested unedited keys survive; edited lists can deliberately clear; additional unedited hero slides survive first-slide copy edits. Malformed/nonobject JSON, stale revisions and create races must fail without a write/audit success.
- [ ] Implement explicit owned-key updates and optimistic revision protection. Preserve creator fields on update. Load a fresh keyed editor from the selected singleton URL instead of switching slug over stale form state.
- [ ] Add contextual dedicated-editor links and permission-aware Content Hub tiles/counts for About, Slider, Forms and Contact Settings; do not query or advertise areas the operator cannot access.
- [ ] Run singleton/action/DOM tests and a disposable two-editor conflict check; verify intentional clears and cache revalidation still work; commit.

### Task 6: Simplify low-impact operator controls without replacing workflows

**Files:** `src/app/admin/content/media/page.tsx`, `src/app/admin/audit/page.tsx`, `src/lib/admin/audit-explorer.ts`; permission-aware Intake discovery in `src/app/admin/bulk-operations/page.tsx`; focused audit tests.

**Interfaces:** Keep every existing form/action/filter/export parameter. Add bounded `actorOptions` containing only user ID and display label to the audit read result; preserve an unmatched current actor UUID as a custom option.

- [ ] Write failing audit filter tests for actor selection, unknown/legacy actor round-trip, unchanged export filters and denied reads before lookup. Bound and minimize actor label queries; do not load full account/member rows.
- [ ] Render the actor selector; retain custom query values and reset behavior. Place all manual media-registration fields/actions inside an Advanced disclosure with upload remaining primary.
- [ ] Add allowed Intake discovery links while keeping all seven bulk-operation types and history. Do not combine member saves, redirect queues/reports, or alter existing certificate enums.
- [ ] Run focused audit/filter/bulk tests and browser checks for keyboard/disclosure/overflow at375/768/1280 in both themes; commit.

### Task 7: Final verification and release

**Files:** the ignored `.superpowers/sdd/2026-10-13-admin-audit-normalization/progress.md` ledger and final operations evidence; no owner scratch files staged.

- [ ] Review the completed new diff once for permission, data-preservation and regression risks. Verify every triage row is fixed, already covered, or explicitly skipped with its reason; no repeated review of PR184.
- [ ] Run the complete unit/component suite, lint, typecheck, production build, access/UI/dependency/credential audits and migration-integrity/order checks. Run production-mode disposable admin/editor acceptance and all three Linux browser engines. No real credentials or role/request changes.
- [ ] Publish source changes and PR through the jnuits GitHub connection, attach the PR, and use the exact-SHA local read-only completion helper without an AI schedule. Merge normally only after every required non-Vercel gate passes; verify the base remains compatible.
- [ ] Verify the actual JnUITS Vercel production SHA and exact-release production smoke, record receipts and limitations, and retain old owner mailbox/backup gaps. No database migrations are expected or may be reapplied.

## Separately authorized GitHub/Vercel status repair

The owner added this task during triage: real READY production59152c0 still has a pending GitHub Vercel context. Investigate through the JnUITS GitHub/Vercel connections and official deployment-check guidance, verify the intended team/project/SHA, inspect required-check configuration and integration events, and make the smallest supported correction. Preserve real release gates and protection. Never forge provider success, disable all CI checks, force promote an unverified build, disconnect/reconnect Git to erase evidence, or generate README commits to retry the status. If a configuration/tool limitation needs owner action, provide a concrete diagnosis and exact setting. Verify subsequent real provider status/event delivery, not merely deployment availability. This repair does not depend on approval of the admin UI plan.

## Plan self-review

All14 audit subsections are mapped in the triage decision table. Tasks use existing permission and data contracts or declare compatible extensions. Each data-loss/security change has behavioral denial/preservation tests; trivial disclosure presentation uses browser verification. The five review-focus cases each map to an explicit task. No generic queue framework, new migration, fixed roster size or dependency is introduced. The owner review is complete; execute natively in this chat.
