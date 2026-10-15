# Frontend view-model contracts — profile/admin accountability

Approved plan: ../superpowers/specs/2026-10-14-profile-completion-admin-accountability-design.md.
Version: 1. Source-code base: c682d6af99538fe0a1b05e4f3466b9396feafaa1.
These are documented presentation contracts, not claims that backend modules/APIs exist. Codex implements server producers/validation; Gemini may use matching local readonly component-prop types and synthetic test fixtures while those producers are pending. No client calculates authorization, completion or inactivity.

## Completion

CompletionField: name | jnuitsId | email | department | batch | studentId | photo | phone | workplace.

ProfileCompletion:
- version: 1.
- status: available | unavailable.
- percent: integer 0–100, or null when unavailable.
- completed, applicable: nonnegative integer counts supplied by the server.
- missing: CompletionField[].

CompletionNextStep:
- field: CompletionField.
- label, href: safe server-supplied strings; href is an approved same-site editor/status/support path.
- mode: self_edit | reviewed_identity | support.
- state: missing | pending_review | needs_verification | unavailable.
- focusId?: an allowlisted generic input identifier; no field value/token/email in a URL.

ProfileCompletionCard props: summary: ProfileCompletion; nextSteps: readonly CompletionNextStep[]; title?: safe display label.
At most three displayed next steps. A missing workplace group may identify its missing organization/designation/location part through label/focusId but is only one scored check.

Server scoring: current member nine checks, alumni eight while workplace applies; explicit valid not_applicable removes one workplace check, leaving eight/seven. Own admin identity remains three, with linked member completion displayed separately. Eight of nine = 89%; seven of eight = 88%. Percentage is supplied, not computed in JSX.

Required synthetic fixtures: available empty/partial/complete; private workplace complete; missing/invalid phone; partial workplace; explicit not_applicable; pending identity review; unavailable data; restricted/unlinked account handled by the existing host screen. Fixtures are for tests, never hardcoded production cards.

## Workplace form compatibility

Extend DirectProfileEditForm presentation props without removing existing props:
- workplaceContractReady?: boolean, default false until the host supplies implemented backend support.
- workplaceApplicability?: applicable | not_applicable | null; null is unanswered.
- Existing currentValues/stepUpActive keep their current meaning.

With support false, retain the existing form and request body; do not send an unsupported field. With support true, add workplaceApplicability only when explicitly changed. Saving uses the existing POST /api/profile/direct password/session/origin/rate-limit path; Codex owns its new enum validation/RPC support.

not_applicable requires blank currentOrganization, designation and workLocation. Never silently clear them or infer the choice from blank data/privacy/student status. An explicit local clear is reviewable before Save and must not mutate on change/GET. Phone/workplace scoring does not make fields required for ordinary saves or portal access.

Generic existing focus targets include dpe-phone, dpe-currentOrganization, dpe-designation and dpe-workLocation. The new applicability control can use dpe-workplaceApplicability. Preserve focus intent through password unlock; focus only once its authorized editor exists.

## Native-session security guidance

AdminSecurityGuidance:
- state: setup | verify | verified | unknown.
- title, description: safe server copy.
- capabilities: readonly { operation: string; label: string; requirements: readonly string[] }[].
- href: existing same-site setup/challenge/settings route or null.

MFA suggestion API retains { ok: true, value: { show, snoozedUntil } }; Codex adds optional value.guidance matching the shape above. Until it exists, retain the current neutral reminder without inventing enrollment/AAL2. Error responses keep { ok: false, code }; they never become a known never-enrolled state.

The current native actor/policy determines session guidance. Role invitation/change/removal still requires native AAL2, current password and exact session/intent-bound proof. Never expose factor lists, QR/setup keys, proof tokens or other users' permissions in this DTO.

## Admin activity

ActivityOutcome: succeeded | failed | denied | unknown.
ActivityItem:
- id, actionLabel, sourceLabel, provenanceLabel: server-supplied strings.
- occurredAt, recordedAt: ISO timestamps.
- actorLabel, targetLabel: safe display labels; unknown stays unknown.
- outcome: ActivityOutcome.
- href?: approved permission-checked same-site detail link.
- context: { ipDisplay, countryDisplay, browser, os, deviceClass }: nullable display strings already redacted/labelled by the server.
- canRequestFullNetwork: boolean for presentation only; the server still authorizes any detail request.

ActivityCoverage:
- state: current | delayed | partial | unavailable.
- observedSince, lastCollectedAt: nullable ISO timestamps.
- message: safe source/coverage explanation.

ActivityPage props: items, coverage, page, pageSize, totalItems and server-supplied filter choices. Default pageSize 25, maximum 100. Server filters/counts/order all records; frontend does not slice an entire dataset or calculate current-role activity eligibility. Backend permits admin.audit.read; full network detail additionally needs admin.security.read. Direct-origin unverified proxy headers do not become visitor metadata.

Legacy Audit Explorer data/view remains supported. New activity presentation is opt-in only after Codex supplies the guarded producer; it never replaces a missing source with mock events.

## Activity summary

AdminActivitySummary:
- status: invitation_pending | never_used | not_seen_six_months | seen_recently | history_unavailable.
- observedSince, firstWorkspaceEntryAt, lastSignInAt, lastWorkspaceAccessAt, lastCompletedWorkAt: nullable ISO timestamps.
- completedWorkCount: nullable count for an explicitly supplied periodLabel.
- label, explanation, periodLabel: safe backend labels.
- href?: permitted audit link.

Do not derive status in the browser from missing arrays, timestamps or Auth last_sign_in_at. Never use “idle”, “never logged in”, online presence, XP or a leaderboard. A never-used state must name the supported observation period. Display dates in Asia/Dhaka.

## Security inbox and preferences

AdminSecurityNotice:
- id, title, summary, actorLabel: safe backend strings.
- occurredAt: ISO timestamp.
- severity: info | warning | critical.
- readAt: nullable ISO timestamp.
- href: nullable permitted same-site link; no invitation/recovery codes or token links.
- deliveryStatus?: pending | accepted | delivered | suppressed | failed | uncertain; provided only to an authorized operator.

Inbox props: notices, page, pageSize (25 default), totalItems, unreadCount (number | null), availability: available | unavailable; authorized callbacks for mark-read/filter/page. Use a non-blocking unread indicator/list. Read state changes only through an explicit owned action/POST, never GET/loading. Unknown counts show unavailable, not a fabricated zero.

Preference form props: ready, admin_security_email_opt_in, admin_recommendation_email_opt_in, pending/error/feedback and the authorized save action. Defaults are off for new optional flags; honor loaded preferences. Essential account-holder security mail is separate and not represented by an editable optional-email toggle. Gemini supplies presentation; Codex modifies existing settings loading/actions/validation.

API paths for the new inbox/activity producers and server-action wiring are backend dependencies, not permission to invent endpoints. Keep presentation callback/prop based until Codex publishes those producers; no mock network intercept may be promoted as production proof.

## Recommendations

AdminRecommendation: { id, label, explanation, href } with safe same-site links. Render at most three server-selected items. Recommendations are distinct from activity monitoring.

Scheduled account-protection summary: configured | needs_setup | unknown, without a live session AAL/proof. Monthly jobs must not reuse a fabricated dashboard actor. Gemini does not implement mail templates, Resend delivery, cron or scheduling.

## Fixture and integration rules

- Frontend prop types may mirror this document; coordinate material contract changes with Codex before committing them.
- Keep fixtures under adjacent DOM/unit tests or ignored browser evidence. No production fake-data route, auth bypass, database mock fallback or invented readiness state.
- Preserve old form/MFA/audit behavior when a new contract is not ready. Advisory data failures show unavailable; authentication/authorization still fail closed at Codex's boundary.
- Backend integration acceptance remains pending until the real producers, forward migrations and disposable guarded flows are tested.
