# Gemini / AGY frontend handover — JnUITS profile and admin accountability

The owner approved the refined plan on 2026-10-14. Complete the frontend work described here, using the checklists as your execution and return record. Preserve JnUITS styling and all existing functionality.

## Workspace and branches

Repository: jnuits/jnuits-full-stack.
Verified source base: c682d6af99538fe0a1b05e4f3466b9396feafaa1.
The handover bootstrap adds approved documents only; its application tree must match that source base.

Work ONLY in:
C:/Users/redwan/.codex/worktrees/profile-admin-accountability-ui/jnuits-full-stack

Your branch:
codex/profile-admin-accountability-frontend

Codex backend/integration branch:
codex/profile-admin-accountability

Codex workspace:
C:/Users/redwan/.codex/worktrees/committee-admin-handover/jnuits-full-stack

Preserve the primary checkout J:/DevDrive/jnuits/jnuits-full-stack, its untracked owner files, all ledgers/backups and other worktrees. Do not reset/clean/rebase another worker's changes or edit the backend worktree. Do not merge, deploy, apply SQL, change providers/permissions/real roles, send emails or create schedules.

## Required reading

- [ ] Read AGENTS.md in this worktree.
- [ ] If dependencies are missing, use the committed lockfile with npm ci in YOUR worktree; never update the lockfile/dependencies for this task.
- [ ] Read relevant installed Next.js documentation in node_modules/next/dist/docs/ before editing code, including server/client boundaries and any touched APIs. This is Next.js 16.3.8; do not substitute training-memory conventions.
- [ ] Read ../superpowers/specs/2026-10-14-profile-completion-admin-accountability-design.md relative to this document.
- [ ] Read all three approved plans in docs/superpowers/plans/ dated 2026-10-14: profile-completion-and-mfa-guidance, admin-activity-and-retention, admin-security-notifications-and-digest.
- [ ] Read [the frontend contracts](2026-10-14-profile-admin-accountability-frontend-contracts.md).
- [ ] Read existing profile/MFA/audit/navigation/settings presentation before changing it. Read J:/DevDrive/jnuits/jnuits-full-stack/.agents/skills/self-improving-ux-framework/SKILL.md if available.
- [ ] Record git status, branch and exact HEAD before work. If the named branch/workspace differs or contains unrelated changes, preserve them and report the discrepancy; do not repair it with a destructive reset.

The plan is approved. Do not reopen settled scope/design decisions or add a redesign. Raise actual missing backend contracts or material inconsistencies with concrete evidence.

## Ownership

You own presentation, accessible interactions, focused component tests and sanitized browser evidence. Codex owns business rules, actual scores, canonical data, session/permission/assurance decisions, APIs/server actions/loaders, RPCs/SQL, providers, jobs, mail, CI gates and releases.

Allowed presentation files (create/modify only those needed):
- src/components/profile/profile-completion-card.tsx and its adjacent DOM tests; optional local readonly props/types matching the contracts.
- src/components/portal/direct-profile-edit-form.tsx and adjacent DOM tests.
- src/components/admin/admin-mfa-suggestion.tsx and its existing DOM tests; preserve current API compatibility.
- src/components/admin/admin-activity-panel.tsx (new) and adjacent DOM tests.
- src/components/admin/admin-activity-summary.tsx (new) and adjacent DOM tests.
- src/components/admin/admin-profile-activity-list.tsx for presentation only.
- src/components/admin/admin-security-notices-panel.tsx (new) and adjacent DOM tests.
- src/components/admin/admin-notification-preferences-form.tsx (new) and adjacent DOM tests.
- src/components/admin/admin-recommendations-card.tsx (new) and adjacent DOM tests.
- src/components/admin/admin-nav-client.tsx and its DOM tests, only for a backend-supplied authorized unread indicator.
- Scoped component styles under src/components/accountability/; reuse existing tokens/control classes.

Codex retains server-host files, including src/components/portal/portal-overview-screen.tsx, src/components/portal/profile-edit-screen.tsx, src/app/admin/page.tsx, src/app/admin/admin-profiles/page.tsx, src/app/admin/audit/page.tsx, src/app/admin/settings/notifications/page.tsx, src/components/admin/admin-shell.tsx and src/components/admin/admin-notification-settings-screen.tsx. Supply the prop/slot integration required from them; do not independently change their loaders/guards.

Do not edit src/lib/auth, server-only src/lib modules, src/app/api, server actions, supabase/, workflows, environment/provider configuration or native auth/proof tests. Do not alter global input/select CSS, recent dropdown/control-height fixes, main landmarks, native MFA setup/challenge, CSP or public/member-card behavior. A necessary boundary change needs Codex coordination, not an improvised backend patch.

## Working sequence and dependencies

- [ ] Start Release 1 presentational components and DOM fixtures immediately.
- [ ] Add workplace UI only behind workplaceContractReady (false by default); old form requests stay unchanged until Codex provides the new column/RPC/DTO. You may test ready=true using synthetic props.
- [ ] Build Releases 2–3 presentational components against documented readonly props/synthetic tests while Codex supplies guarded sources.
- [ ] Keep live page/route integration, new persisted mutations and real browser-flow acceptance pending until the required backend contracts exist.
- [ ] Return a clear dependency matrix; fixtures passing is not evidence of real backend or production readiness.
- [ ] Deliver focused frontend commits in release order; Codex integrates them into the backend/integration branch and owns final checks.

No production mock routes, hardcoded scores/events, fake Auth actors, forced permission flags or database fallback fixtures. New components can compile with local matching readonly prop types; reconcile those types with Codex's producer before integration.

## Release 1 checklist — completion and MFA guidance

- [ ] Render a labelled accessible Profile completeness indicator using the server-supplied score/counts; do not calculate the percentage or eligibility.
- [ ] Show at most three useful next steps; render complete, unavailable, pending review and needs-verification states.
- [ ] Include scored phone and workplace guidance; workplace is one group covering organization, designation and location.
- [ ] Preserve social links as optional/unscored and public/private choices independent of the score.
- [ ] Provide applicable/not-applicable workplace selection only after existing current-password unlock.
- [ ] Never infer not-applicable from blank fields/student status/privacy. Reject/explain contradictory nonblank workplace information; no silent clearing.
- [ ] Any explicit local clearing is visible/reviewable before Save; selecting the status does not issue a mutation.
- [ ] Keep profile saving advisory and partial: missing details do not disable ordinary saves/account access.
- [ ] Preserve the old request body when workplaceContractReady is absent/false. Handle pending/success/error/retry without duplicate submissions.
- [ ] Missing-item links contain only generic focus identifiers. Keep the existing password gate first and focus only after the editor is authorized/rendered.
- [ ] Do not serialize/display protected phone/student-ID/email/workplace values in a locked progress hint.
- [ ] Keep identity corrections on the current reviewed workflow and show existing pending review instead of offering a duplicate request.
- [ ] Refresh completion only from canonical saved/approved data; no points from failed uploads or submitted requests.
- [ ] Show own admin completion separately from a linked member/alumni profile; do not force a member link or duplicate phone/workplace records.
- [ ] Enhance the single existing MFA reminder with supplied state/capability requirements and optional expanded explanation.
- [ ] Keep native setup/challenge links and seven-day snooze. Configured factor and current AAL2 are distinct.
- [ ] State that permissions remain role-bound and role invitation/change/removal also requires current password plus exact operation proof.
- [ ] Preserve neutral old reminder behavior if the new guidance property is absent; unknown/stale evidence must not be labelled never enrolled.
- [ ] Keep CAPTCHA on public/contact/Form Studio/login submissions and no CAPTCHA inside authenticated dashboards.

## Release 2 checklist — activity presentation

- [ ] Build the new activity view as a presenter within the existing Audit Explorer; preserve existing audit functionality.
- [ ] Display backend-supplied actor, target, action, outcome, timestamp and source/provenance.
- [ ] Keep successful/failed/denied/unknown outcomes visibly distinct; do not infer success from a click.
- [ ] Display trusted/redacted IP/country/device context exactly as supplied; unknown remains unknown and proxy/edge evidence stays labelled.
- [ ] Full-network controls use supplied availability plus guarded callbacks; no raw-payload disclosure or frontend permission calculation.
- [ ] Support actor/action/outcome/date filters, controlled pagination (25 default, 100 max) and truthful totals.
- [ ] Preserve all key information on phones through stacked rows/detail disclosure, without page overflow.
- [ ] Show observed-since/last-collected/partial or delayed coverage; do not turn unavailable data into zero activity.
- [ ] Render factual summary dates and server classifications, including invitation pending, observed never-used, six-month absence and history unavailable.
- [ ] Format dates in Asia/Dhaka. Do not calculate inactivity eligibility from browser time/empty arrays.
- [ ] No “idle” label, presence dot, XP, ranking, duty judgment or automatic access removal.

## Release 3 checklist — notices and recommendations

- [ ] Add a non-blocking authorized unread indicator/list; no forced dialog, focus theft or auto-navigation.
- [ ] Render safe notice actor/action/time/severity and supplied permission-checked links; no codes, tokens or full IPs.
- [ ] Mark read only through an explicit own action/POST; no state mutation from GET or automatic page loading.
- [ ] Handle pending, empty, unavailable, stale permission and retry states accurately; unknown counts are not zero.
- [ ] Distinguish provider accepted versus delivered/suppressed/failed/uncertain when authorized delivery status is supplied.
- [ ] Add the two optional peer-security/monthly recommendation toggles only when backend-ready; defaults off, loaded preferences preserved.
- [ ] Keep essential account-holder security mail distinct from optional-email toggles.
- [ ] Present at most three server-selected personal recommendations; no client queue access/role decisions.
- [ ] Monthly guidance uses account-level enrollment, not an invented current browser AAL2 session.
- [ ] Do not send mail, edit email templates/provider settings, add marketing subscriptions or create jobs.

## Verification and evidence checklist

- [ ] Add focused behavioral DOM tests with synthetic available/unavailable/pending/denied/legacy-compatible fixtures, including cross-field/no-leak assertions.
- [ ] Run targeted Vitest for changed components and related existing tests; record exact commands/counts.
- [ ] Run npm run typecheck and npm run lint; resolve your own regressions rather than weakening tests.
- [ ] Run a production build after Codex provides the required safe local/disposable configuration. If unavailable, record the exact dependency instead of fabricating a pass or reading production secrets.
- [ ] Browser-test the integrated disposable build at mobile 375px, tablet 768px and desktop 1280px, actual light/dark themes.
- [ ] Test keyboard/tab/Enter/Escape behavior, visible focus, accessible labels/progress, no overflow/clipping, and no duplicate submit/mark-read.
- [ ] Recheck existing profile editing/password verification, native select expansion/control heights, admin navigation, public hamburger/submenus and certificate input visibility.
- [ ] Check console/hydration errors and relevant denied/pending/unavailable states. Do not weaken CSP or public CAPTCHA to make tests pass.
- [ ] Exercise Chromium, Firefox and WebKit where available. Report actual unsupported engines; Codex still owns required Linux three-engine release gates.
- [ ] Screenshots/evidence must use synthetic/disposable identities and redact credentials, emails/personal records, tokens, QR codes/setup keys.
- [ ] Save generated browser reports/screenshots under ignored artifacts/frontend-audit-evidence-accountability/; confirm ignored before writing. Never stage generated evidence, scratch files, environment files or credentials.
- [ ] Record exact frontend and integrated backend SHAs separately. Screenshot fixtures/transport mocks are not production acceptance.

Browser authorization: use disposable environments for mutations and inbox/preferences/profile flows. If Codex supplies designated RBC test-account access, normal authentication and existing-factor verification are allowed; production tests remain non-mutating. All role-labelled accounts in the privately held J:/DevDrive/jnuits/Credentials.txt were designated RBC by the owner, but verify account availability with Codex and never assume a deleted/stale account is usable. Do not print/read out credentials, impersonate real members, enroll/remove factors, approve requests, change roles or send emails for testing. Owner performs the consenting real-mailbox acceptance.

## Return checklist and report format

- [ ] Commit only owned frontend files, in small meaningful commits; no backend/helper/workflow/migration edits.
- [ ] Do not merge, deploy or move main. Leave branch/worktree intact for Codex integration.
- [ ] Return each commit SHA with its task/files and the exact baseline HEAD.
- [ ] Return this checklist with checked/unchecked items; blocked items must name the missing backend contract/evidence.
- [ ] Return a task-to-commit table: task, commit, tests, browser evidence, dependency/status.
- [ ] Return commands/results with test counts and failures/skips honestly described.
- [ ] Return sanitized screenshot/report paths with viewport/theme/browser and tested frontend/backend SHAs.
- [ ] Return any contract mismatch or unavoidable shared-file integration change as a specific patch suggestion for Codex.
- [ ] State clearly which production/backend acceptance items remain open; do not call all work complete from fixtures alone.

Write the return summary into docs/operations/2026-10-14-gemini-accountability-frontend-return.md in YOUR frontend branch. Do not rewrite this assignment or the approved plan to remove incomplete items.
