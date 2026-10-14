# Profile Completion and MFA Guidance Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for Codex-owned work. Frontend ownership follows docs/operations/2026-10-14-gemini-frontend-accountability-handover.md. Codex retains backend and release ownership. Steps use checkbox syntax for tracking.

**Status:** Approved by the owner on 2026-10-14; branch/handover preparation only, implementation not started.
**Goal:** Give members, alumni and admins private, useful profile-completion guidance and explain existing authenticator requirements.
**Architecture:** A pure versioned rubric consumes server-validated presence evidence. Existing owned-profile loaders supply safe summaries to small progress components; the current MFA reminder receives permission-aware guidance.
**Tech Stack:** Installed Next.js 16.3.8, React 19.2.4, TypeScript, Supabase Auth/Postgres, Zod, Vitest, Playwright.
**Spec:** ../specs/2026-10-14-profile-completion-admin-accountability-design.md, Release 1.

## Refinement and later ownership gate

- The owner accepted the keep/drop direction and chose scored phone/workplace; workplace applicability and presentation are approved.
- Codex supplies rubric, owned loaders, native security policy and redacted DTO fixtures. Gemini presentation/tests are assigned in the frontend handover with exact paths and documented contracts.
- Server state is authoritative: pending requests/failed uploads do not raise the score, and field-link focus waits for the existing password unlock.
- The owner approved the design; the frontend handover is prepared. Backend integration remains gated on actual implemented contracts and evidence.

## Global Constraints

- Read AGENTS.md and relevant installed Next.js documentation before code.
- Rubric version 1 uses equal-weight applicable checks; members have nine and alumni eight when workplace applies, or eight/seven after an explicit valid workplace not-applicable declaration. Own admin identity remains three; linked member details use their own rubric.
- Source unavailable means unavailable, not 0%. Completion is advisory, private and independent of visibility/roles/MFA/consent.
- Keep current-password unlock, reviewed identity changes, optional MFA enforcement and exact role-operation proof rules.
- Keep CAPTCHA on public/login submissions; no CAPTCHA inside authenticated dashboards.
- Preserve primary checkout, other work, backup branches, existing migrations and ignored ledgers.

## Review Focus

- Older valid department/batch records remain complete without forced identity changes (Task 2).
- Pending identity requests never inflate a canonical-data score (Task 2).
- A missing admin/member link does not leak a different profile or produce a false 0% (Task 3).
- A stale/unavailable assurance state does not promise privileged access (Task 4).
- Private locked-field values never appear in serialized summary props or DOM (Task 3).

### Task 1: persist workplace applicability without changing identity policy

**Files:** Add generated forward migration member_workplace_applicability; modify src/lib/portal/member.ts, src/lib/members/profile-update-policy.ts, src/app/api/profile/direct/route.ts and its tests, and existing atomic workplace-write paths. Create src/lib/profile/workplace-applicability.test.ts for the new applicability contract. Update generated database types via clean replay. UI changes stay in Task 3 for the later AGY handover.

**Interfaces:** members.workplace_applicability is nullable with values applicable | not_applicable; null means no explicit choice, not automatic exclusion. Add workplaceApplicability to the existing routine self-service patch allowlist; preserve its current-password, valid-session, lifecycle, origin and rate-limit checks. All existing workplace writers preserve the same atomic consistency rule.

- [ ] Write failing tests for no-choice/blank workplace staying incomplete, complete legacy fields counting without backfill, explicit not_applicable with blank workplace fields, and not_applicable plus nonblank fields being rejected. Include private visibility counting equally.
- [ ] Test owned password-unlocked updates, unauthenticated/locked/cross-account/forged identity denial, and existing direct/admin/legacy-review writers preserving consistency when workplace information is supplied later.
- [ ] Run focused Vitest and disposable clean SQL replay; confirm failures before the new column/allowlist exists.
- [ ] Generate the forward migration through the Supabase CLI; add the narrow nullable column and allowed-value/consistency constraints. Extend the existing service-owned atomic update, with no historical migration edits or production backfill. If a later successful workplace update supplies actual details, its atomic writer sets applicability to applicable.
- [ ] Reject contradictory not_applicable requests without silently erasing data. The editor can offer an explicit local clear of workplace fields before the owner saves the combined change; server-side partial failure must leave the old values intact.
- [ ] Run behavioral/RLS/replay tests and unchanged identity/privacy/role-guard regressions. Commit Task 1 files and migration.

### Task 2: pure completion rubric and owned evidence adapter

**Files:** Create src/lib/profile/completion.ts, src/lib/profile/completion.test.ts, src/lib/profile/completion-server.ts and src/lib/profile/completion-server.test.ts. Consume src/lib/portal/member.ts, src/lib/admin/admin-profile-model.ts and existing ID/field normalization and src/lib/phone.ts. Task 1 adds only the narrow workplace-applicability edit contract; identity approval and access contracts remain unchanged.

**Interfaces:** CompletionField adds phone and workplace to the previous name/identity/email/department/batch/student-ID/photo checks. completion.ts exports CompletionKind = member | alumni | admin; CompletionEvidence (known boolean/null checks plus workplaceApplicable: boolean | null; false requires a valid persisted not-applicable declaration, null means unavailable evidence); ProfileCompletion (version: 1, status: available | unavailable, percent: number | null, completed: number, applicable: number, missing: CompletionField[]). evaluateProfileCompletion(kind, evidence): ProfileCompletion. completion-server.ts exports getOwnProfileCompletion(kind: CompletionKind): Promise<ProfileCompletion | null>; it resolves the authenticated identity itself, validates the selected account kind and uses the owned request-memoized snapshot, without a browser-supplied user ID or persistent cross-user cache.

- [ ] Write failing rubric tests named current_member_nine_checks, alumni_eight_checks, admin_three_checks, phone_format_counts, workplace_requires_three_parts, explicit_not_applicable_excludes_group, unanswered_workplace_is_incomplete, empty_partial_complete, unknown_is_unavailable and privacy_does_not_change_score. Assert eight of nine is 89%, seven of eight is 88%, an explicit valid workplace exclusion changes the applicable count rather than fabricating a completed check, and all applicable valid checks is 100%.
- [ ] Add adapter tests for valid legacy department, normalized batch, pending correction, missing link, restricted account and cross-account attempted access. Assert no request payload or alternate-user data changes the summary.
- [ ] Run npx vitest run src/lib/profile/completion.test.ts src/lib/profile/completion-server.test.ts; confirm failure because the specified interfaces do not yet exist.
- [ ] Implement the spec rubric and server adapter using existing canonical validators and verified owned Auth email. Reuse a request's loaded snapshot where available; do not perform browser database queries or persist a score column.
- [ ] Run the same tests; expect all pass. Commit only Task 2 files.

### Task 3: responsive progress and safe next steps

**Files:** Create src/components/profile/profile-completion-card.tsx and profile-completion-card.dom.test.tsx. Modify src/components/portal/portal-overview-screen.tsx, src/app/admin/page.tsx, src/app/admin/admin-profiles/page.tsx and the existing self-profile presentation. Modify src/components/portal/direct-profile-edit-form.tsx and src/components/portal/profile-edit-screen.tsx to present the applicability choice after unlock. Extend their existing DOM tests; create e2e/profile-completion.spec.ts.

**Interfaces:** ProfileCompletionCard({ summary: ProfileCompletion, nextSteps: CompletionNextStep[] }); CompletionNextStep = { field: CompletionField; label: string; href: string; mode: self_edit | reviewed_identity | support; state: missing | pending_review | needs_verification | unavailable }. Return only labels/state/owned links, never field values. Show at most three next steps; workplace may identify its missing organization/designation/location part without assigning additional score points. Optional suggestions are visually separate.

- [ ] Write failing DOM tests for labelled accessible progress, unavailable state, 100% state, three-step limit, permitted link paths and absence of sensitive fixture values. Add browser fixtures for current member, alumni and own admin profile. Include password-locked editor entry, generic field-link focus only after unlock, pending review, failed save/upload and preserved canonical score.
- [ ] Run npx vitest run src/components/profile/profile-completion-card.dom.test.tsx; confirm the new contract fails before implementation.
- [ ] Implement the card and owned server integrations. Link member edits through the existing password-unlocked screen, not a new identity mutation. Keep unavailable/restricted states and existing dashboard content intact. Label it Profile completeness; refresh only from canonical saved data. Pending review is explicit and does not produce another request link. Provide the applicable/not-applicable workplace choice after password unlock; never infer it from empty fields, erase existing data automatically or make the score a save/access requirement.
- [ ] Run the DOM test and npx playwright test e2e/profile-completion.spec.ts --project=chromium. Expect no cross-account/locked-data leaks, keyboard access and correct links. Test 375px/768px/1280px in actual light/dark themes; run Firefox/WebKit in release verification.
- [ ] Commit Task 3 changes; update the release ledger with exact command outcomes and screenshots without protected data.

### Task 4: permission-aware MFA guidance

**Files:** Create src/lib/admin/security-guidance.ts and security-guidance.test.ts. Modify src/components/admin/admin-mfa-suggestion.tsx, its DOM test, src/app/api/admin/mfa-suggestion/route.ts and route.test.ts. Consume src/lib/auth/admin-verification/actor.ts, operations.ts and existing MFA setup/challenge components.

**Interfaces:** buildAdminSecurityGuidance({ actor: AdminVerificationActor, permittedOperations: AdminOperationIntent["operation"][] }): AdminSecurityGuidance. The safe result exposes state (setup | verify | verified | unknown), permitted operation labels, requirements and an existing setup/challenge link. Missing actor/policy never falls back to invented known enrollment. Extend the API envelope/schema atomically; preserve show/snoozedUntil and seven-day snooze behavior.

- [ ] Add failing tests for permission-scoped capabilities, enforcement on/off, enrolled AAL1, verified AAL2, positively known never enrollment, legacy unknown and unavailable/stale session. Assert MFA never grants a role or replaces current-password/intent proof.
- [ ] Run npx vitest run src/lib/admin/security-guidance.test.ts src/components/admin/admin-mfa-suggestion.dom.test.tsx src/app/api/admin/mfa-suggestion/route.test.ts; verify the new behavior fails first.
- [ ] Implement guidance using existing actor/operation policy; preserve server authorization and existing native setup/challenge paths. Render one MFA reminder rather than duplicate global banners; expand the capability explanation on demand. Unknown evidence uses neutral settings guidance.
- [ ] Run those tests and existing src/lib/auth/mfa.test.ts / admin verification tests. Confirm no dashboard CAPTCHA and unchanged public/login CAPTCHA tests.
- [ ] Commit Task 4 changes.

### Task 5: Release 1 acceptance

**Files:** Update docs/operations/admin-verification.md and create docs/operations/profile-completion.md. Record execution in .superpowers/sdd/2026-10-14-profile-completion-and-mfa-guidance/progress.md (ignored).

- [ ] Run full unit/component suite, lint, typecheck, production build, dependency/credential gates and admin access/UI audits using current repository commands. A narrow reviewed forward migration is now required for workplace applicability. Run clean replay, migration integrity/order/parity and effective permission checks; never alter/reapply the historical 120-migration baseline.
- [ ] Complete disposable authenticated acceptance for all three account kinds, stale/unavailable sources, native MFA guidance and mobile/tablet/desktop themes. Preserve existing editing, dropdown/control heights and role workflows.
- [ ] Apply the reviewed workplace-applicability migration through Supabase with pre/post receipts before enabling dependent application contracts. Preserve compatibility with previous application writers; no production data backfill or silent clearing.
- [ ] Perform one focused release review; resolve concrete findings without repeated independent whole-branch reviews.
- [ ] Open/attach the release PR, verify exact-head required non-Vercel CI including three Linux browser engines, merge normally only when green, then verify main and actual production SHA/smoke.
- [ ] Keep historical mailbox/backup gaps separate. Record completion only from actual evidence; use the local bounded CI helper, not a recurring AI schedule.

Next release: admin-activity-and-retention. Do not assume those later interfaces exist here.
