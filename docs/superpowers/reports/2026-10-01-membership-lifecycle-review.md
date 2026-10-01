# Membership lifecycle review and decision record

Date: 2026-10-01 (Asia/Dhaka).

## Review and resolution

One fresh `gpt-6-astra` reviewer inspected immutable `bde3209..d0482cd`
read-only against the binding specification and renewal/departure plan.
It reported five Important findings, no Critical findings and no Minors.
The implementer completed one regression-first fix pass, with no re-review.
This records addressed findings and local evidence, not a new reviewer verdict
or permission to deploy.

- alumni portal role regression — actual SQL active-grant/mentorship/claim-version assertions RED→GREEN, independent admin scope and frozen security preserved, suite 1670/1670.
- backdated premature reactivation — actual SQL historical-receipt/current-Dhaka-access assertion RED→GREEN, suite 1670/1670.
- legacy unpaid-former reactivation — actual service lifecycle setter refusal/security-only-edit assertions and actionable admin renewal-queue guidance RED→GREEN, suite 1670/1670.
- both direct profile boundary bypasses — expired reread, restricted path and transport-failure handler tests RED→GREEN (12), suite 1670/1670.
- normal-request/alumni direct database policy bypass — real authenticated-role statements with rollback-only exposure grants RED→GREEN; no production grants widened, suite 1670/1670.
- retained alumni-onboarding ambiguous canonical lookup — real PostgreSQL function lint RED→GREEN, added every-replay lint gate, suite 1670/1670.

Full suite: 259 files / 1,670 tests. Type checking, lint, strict order,
admin access/UI audits, CI-placeholder production build, 109-migration
replay, public/private SQL function lint and 64 authenticated local browser
combinations passed. Local security advisors returned no issues. Synthetic
fixtures rolled back; disposable local Auth state was stopped. No hosted
writes, push or merge occurred. Hosted migration history remains 102 entries;
seven local versions await reviewed rollout. CAPTCHA remained enabled and
no member password was printed or stored.

The RLS reproduction used rollback-only INSERT/UPDATE/SELECT grants to test
policy behavior independently of API exposure. Read-only hosted checks show
those authenticated grants are currently false; this is policy hardening,
not a claim that production presently permits the reviewed direct-table attack.

## Rulings I made

The following list is exhaustive and chronological, including every behavior
the reviewer declined to judge. Each carries its potential cost if wrong.

- Pre-flight: Tasks 4→7 — Task 4 requires loader reconciliation before Task 7 introduces its wrapper. Ruling: introduce the minimal tested wrapper when Task 4 first needs it, then verify Cron/admin/loader parity in Task 7 — avoids an unsafe temporarily stale guard — cost if wrong: reorder wrapper integration only.
- Pre-flight: Tasks 2→8 — migration filename in plan predates the committed 20261001090000 forward fix. Ruling: generate the next forward migration with the Supabase CLI rather than inserting before its dependencies — preserves replay order — cost if wrong: migration name update, never rewriting applied history.
- Ruling: missing live public Sheet verification blocks intake production readiness, not local development of independent renewal behavior — keep the unresolved intake gate explicit and do not publish either slice prematurely — cost if wrong: extra integration verification before release.
- Task 2: in progress — behavior-based SQL assertions replace fragile source-text contract assertions. Ruling: run schema/privilege/transition assertions in the disposable replay, and keep only a migration artifact/order assertion in Vitest — static strings cannot prove transactional behavior — cost if wrong: longer database verification runtime.
- Task 2 Ruling: derive human actors from the request-scoped authenticated JWT as existing onboarding does; privileged renewal/review RPCs require active membership-admin permission plus AAL2 inside PostgreSQL. Ordinary authenticated members cannot confirm/review; authorized MFA administrators can call these RPCs. Reconciliation remains service-only. This resolves the plan's incompatible service-only/derive-auth.uid wording without accepting caller-supplied actor IDs — cost if wrong: authorized operators can invoke the same guarded transition outside the UI; final security review must explicitly assess this boundary.
- Task 3 pre-flight Ruling: actual transactional application UI calls src/app/admin/applications/membership-actions.ts; the plan named the older nontransactional moderation action. Update the actual entry point and delegate the older approval to it, with an additive approval/intake-trigger migration — prevents two divergent approval systems — cost if wrong: legacy approval redirects to the dedicated application workspace rather than the dashboard.
- Task 4 Ruling: add a service-only SECURITY INVOKER membership-state read RPC in forward migration 20261001090003, generated via CLI and moved after its dependencies. PostgreSQL returns grace-end and renewal state, preventing a competing TypeScript date calculator. The DAL checks authenticated ownership and omits normal profile data for restricted identities — cost if wrong: one additive read RPC to revise before release.
- Task 4 Ruling: update avatar/workplace direct handlers together with the shared mutation predicate; require reconciliation and current-path state so the predicate change neither breaks legitimate active uploads nor permits direct-request bypasses — cost if wrong: wider focused API regression testing, no production mutation.
- Task 5 Ruling: route the legacy alumni form to the canonical membership choices screen after identity authorization, rather than retaining a second privileged request writer — one authenticated, revision-checked transition contract preserves future alumni eligibility — cost if wrong: an extra navigation for older alumni links.
- Task 6 Ruling: introduce service-only SECURITY INVOKER read RPC get_membership_admin_queue, gated by membership permission in its server-only DAL, rather than classify dates or expose full members in the browser — SQL owns Dhaka upcoming/overdue classification and 1–50 bounded pagination — cost if wrong: one additive DTO function to revise before release.
- Task 6 Ruling: the legacy account reviewer now handles deletion only; alumni/departure/appeal decisions use the request-scoped, AAL2 guarded transactional RPC and expected request timestamp — eliminates a duplicate approval path that lifted security freezes — cost if wrong: old current-member alumni requests require explicit lifecycle correction instead of unguarded approval.
- Task 7 Ruling: integrate the queue fallback in its permission-checked server DAL (used by the admin page), not a duplicate page-only call — each admin read is authorized before a bounded 500-row reconciliation, each portal fallback remains owned/member-scoped with bound 1 — cost if wrong: one DAL call to relocate, no competing SQL policy.
- Task 8 Ruling: repair the role-only access-pending redirect and restricted-page explanation during integration verification despite its tests/docs-only file list — the discovered loop prevents frozen users reaching the required blocked surface; role existence is not security eligibility — cost if wrong: eligible users visiting access-pending remain on an explanatory page, while all actual portal guards remain authoritative.
- Task 8 Ruling: mirror only legacy server SELECT grants in the disposable Auth fixture, because CLI 2.109.1 fresh opt-in exposure differs from the hosted project's read-only-confirmed existing grants — avoids enabling deprecated browser auto-exposure or changing production privileges — cost if wrong: this smoke test does not certify a newly created hosted project's historical grants; production rollout must check them separately.
- Task 8 Ruling: build using the existing CI placeholder environment because this isolated worktree has no production environment file — verifies production compilation without reading or changing production secrets; CAPTCHA remains true — cost if wrong: real hosted secret availability and deployment remain separate release gates.
- Final: Ruling: hosted request-table INSERT/UPDATE/SELECT grants are currently false (Supabase plugin read-only check), contrary to the review's immediate-production-exploit premise — retain the RLS finding as an Important policy-contract defect and fix without widening production/browser privileges; test the policy behind explicit rollback-only fixture grants so CLI defaults cannot hide it — cost if wrong: tighter normal-request eligibility if those grants are ever restored, not a new production write surface.
- Final: Ruling: preserve historical receipt dates for audit but compute current access from server-owned Dhaka today — a caller-selected historical date cannot restore unpaid current membership; fixed boundary helper/reconciliation tests remain deterministic and catch-up integration adapts to real today — cost if wrong: historical receipt confirmations do not recreate historical portal-access state, which is intentionally outside this workflow.
- Final: Ruling: apply review corrections in a CLI-generated forward migration 20261001154954, not edited earlier migrations — leaves committed/applied history intact and preserves current RPC signatures/ACLs — cost if wrong: one additional additive migration to revise before release.
- Final: Ruling: minimally qualify that retained onboarding lookup in the same forward fix and add real function lint to replay — prevents valid ID-based alumni onboarding failing while leaving its existing contract, security mode and ACLs unchanged — cost if wrong: larger forward function definition to compare during hosted rollout; this is not a redesign/certification of other legacy onboarding behavior.
- Final: Ruling: committee finalization and automatic outgoing-EC conversion remain subsequent-plan work — users do not yet get that feature from this renewal slice — cost if wrong: finalization requires a separate implementation/verification phase before full completion.
- Final: Ruling: photo processing/quality redesign remains subsequent-plan work; existing avatar authorization integration was reviewed — canonical member/advisor photo completeness is not claimed — cost if wrong: photo workflow/UI defects may remain until its planned phase.
- Final: Ruling: positive live public-Google-Sheet verification remains an unresolved intake release gate — asked for a fictional public sample and do not claim external Sheet success — cost if wrong: live sharing/format integration may need corrections before release.
- Final: Ruling: hosted rollout, production secrets/data and real admin-MFA browser operation were not certified by local fixtures — preserve these explicit release checks and request authority at the publication boundary — cost if wrong: local success may differ from production configuration or operator sessions.
- Final: Ruling: issue #75 historical write/TRUNCATE grant evidence predates this range and is not certified fixed — new ledger grants are restricted; current hosted request-table grants were checked separately — cost if wrong: baseline grant risks require their own production audit/remediation before a global security claim.
- Final: Ruling: unrelated pre-existing profile/API defects set aside by the reviewer are not silently certified — only concrete lifecycle bypasses and the discovered retained-function compile failure were corrected in this pass — cost if wrong: unrelated legacy behavior still requires its own targeted investigation.

## Deferred minors

None reported or deferred in this review.

## Remaining program/release gates

- Committee roster finalization and outgoing-EC alumni conversion.
- Canonical member/advisor photos and their admin/public integration.
- A positive real public-Google-Sheet import test (fictional rows only).
- Authorized hosted migrations, configuration/data/advisor checks, real
  admin-MFA browser verification, GitHub checks and deployment verification.

The full master plan is therefore not 100% complete. The backup branch was
not changed. This branch and worktree remain available for the user's
integration decision.

## Database guidance consulted

[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [function security](https://supabase.com/docs/guides/database/functions)
informed the policy/ACL checks; project-specific outcomes above come from
the actual local tests and read-only hosted inspection.
