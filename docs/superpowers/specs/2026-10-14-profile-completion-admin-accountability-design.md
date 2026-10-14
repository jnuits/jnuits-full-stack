# Profile completion and admin accountability: proposed design

Status: approved by the owner on 2026-10-14. Branches and frontend handover are prepared; application features, SQL and provider jobs have not been implemented/enabled by these documents.
Source revision: c682d6af99538fe0a1b05e4f3466b9396feafaa1 (main, 2026-10-14).
Scope: the owner's Future plan and Additional ideas, clarified in this chat. The completed member-card/EC work is outside this change.
Refinement round 3: the owner accepted the keep/drop direction, confirmed existing audit permissions for cross-admin logs/notices, and chose to include phone and workplace in completion. The owner approved the full refined plan, including scoring/applicability, on 2026-10-14. Codex/Gemini execution ownership and the frontend checklist are recorded in the handover linked below.

## Purpose and selected approach

Help members finish useful profile information, help admins understand account protection, and give authorized operators reliable security/activity evidence. Preserve existing workflows and JnUITS styling.

Recommended: extend existing profile editors, MFA guidance, audit explorer and Resend delivery code in three independently releasable stages. A separate analytics/monitoring platform would duplicate existing features and add operational cost. A gamified admin-management system would turn uneven duties and security-sensitive actions into an unreliable competition.

| Idea | Decision | Selected behavior |
| --- | --- | --- |
| Member/alumni completion percentage | Keep | Private 0–100% core-profile indicator and at most three next steps. |
| Admin profile suggestions | Keep | Own-profile completion; no requirement to attach an unrelated member identity. |
| MFA/TOTP benefits | Keep, clarify | Explain verification requirements for capabilities already granted by the admin's role. |
| Admin login/action logs | Keep | Extend the audit explorer, with permissions and honest source/provenance labels. |
| IP/country/device | Keep with limits | Verified network evidence and coarse browser/OS/device; unknown when unavailable. No physical-device or exact-location claims. |
| Password/invitation notices | Keep | Authorized in-panel notices; account-holder security email and explicitly opted-in peer emails. |
| Three-month logs | Keep | At least three calendar months of new event details; longer existing retention remains intact. |
| Six-month inactivity / never used | Keep, clarify | Factual workspace-access dates and evidence-qualified states; no automatic removal. |
| Monthly recommendations | Keep | Optional personal digest, only when there is a useful permitted next step. |
| XP, ranks and leaderboards | Drop from this plan | Private completed-work summaries are more useful and harder to game. |
| “Idle” labels, productivity scores | Drop | No inference about employment, effort, leave or offline duties. |
| Email every admin about every login/edit | Drop | Logs remain searchable; selected security events receive notices. |
| Automatic role revocation, forced public profiles, always-on AI monitoring | Drop | Human review, existing privacy choices and ordinary application jobs. |

## Existing foundations and verified limits

- Verified main base is c682d6af99538fe0a1b05e4f3466b9396feafaa1. Codex uses the attached committee-admin-handover worktree on codex/profile-admin-accountability; Gemini uses the separate profile-admin-accountability-ui worktree on codex/profile-admin-accountability-frontend. The original planning branch is preserved. Preserve primary checkout changes, other worktrees, backups and ledgers.
- Member snapshot: src/lib/portal/member.ts. Portal overview: src/components/portal/portal-overview-screen.tsx. Existing password-unlocked editor and reviewed identity changes remain authoritative.
- Admin self profile: src/app/admin/settings/profile/page.tsx delegates to the self tab of src/app/admin/admin-profiles/page.tsx. Do not build against the unrelated older settings-screen component.
- Existing snoozable MFA guidance: src/components/admin/admin-mfa-suggestion.tsx, src/app/api/admin/mfa-suggestion/route.ts and src/lib/auth/admin-verification/.
- Existing audit/security data: public.audit_events, public.security_events and private.admin_verification_audit. Existing viewer: src/lib/admin/audit-explorer.ts.
- Existing optional email preferences and Resend transport: src/lib/notifications/preferences.ts, send-email.ts and resend-webhook.ts.
- Read-only hosted inspection of fsirdkjgrcocowxqjhjg on 2026-10-14 found auth.audit_log_entries exists but contains zero rows. Its columns include payload, created_at and ip_address; it has no dedicated user_agent column. This proves neither historical absence of login nor the cause of missing rows. Provider audit-storage configuration and real event shapes still need verification.
- The existing 120 local/hosted migration versions were matched at the last release. Recheck at execution; never reapply them. supabase/schema.sql is a historical snapshot, not proof of current effective grants.

## Release 1: profile completion and security guidance

Confirmed field scope: phone and workplace contribute to member/alumni completion. Social links remain optional and unscored. The approved workplace not-applicable rule below prevents false missing-workplace pressure without treating an unanswered field as complete.

### Profile-completion rubric, version 1

Use equal-weight, valid persisted checks. Percentage is round(100 × complete applicable checks / applicable checks); display 100 only when every applicable check passes. An unavailable source produces an unavailable state, not 0% or invented missing fields.

| Check | Current member | Alumni | Admin |
| --- | --- | --- | --- |
| Valid persisted name | Full name | Full name | Own display name |
| Canonical identity | JnUITS ID | JnUITS ID | Not applicable |
| Verified linked login email | Yes | Yes | Verified Auth email |
| Recognized department | Yes | Yes | Not applicable |
| Valid normalized batch | Yes | Yes | Not applicable |
| University student ID | Yes | Not scored | Not applicable |
| Persisted profile photo | Yes | Yes | Own admin photo |
| Valid phone format | Yes | Yes | Via linked member profile only |
| Workplace details group | Yes when applicable | Yes when applicable | Via linked member profile only |

Use existing ID/batch/field validators and the established telephone contract in src/lib/phone.ts (normalizePhoneAnswer/resolvePhoneEntry, including its default-country/local handling). Scoring does not rewrite saved numbers or claim phone ownership/SMS verification. A valid persisted legacy department remains valid even if no longer offered for new intake. An accepted correction counts after it reaches canonical data; a pending request does not. Placeholder/default initials are not an uploaded photo.

Phone is one scored check. Workplace is one equally weighted check requiring valid nonblank current organization, designation and work location together; incomplete parts produce targeted next steps without receiving extra points. Members have nine applicable checks and alumni eight while workplace applies. An explicit, persisted workplace not_applicable declaration excludes that one group, leaving eight and seven respectively. An unanswered/blank workplace remains incomplete; do not infer not-applicable from being a student, unemployment, age, classification or privacy.

Add a narrow nullable workplace_applicability choice to the existing member record, saved through password-unlocked ordinary self-service. A not_applicable declaration is valid only when the three current-workplace fields are blank. Contradictory values are rejected; existing data is never silently cleared, hidden or rewritten. The editor may explicitly clear those fields locally for the owner to review/save with the declaration. Existing populated legacy records count using their fields without a production backfill, and all subsequent authorized workplace writers maintain consistency.

Admin identity completion stays at its three existing own-profile checks because the admin-profile model has no phone/workplace fields. A linked member/alumni completion card follows the expanded rubric; do not duplicate those records or force an unrelated member link. Graduation year, admin title and social links remain optional and outside the percentage. Show relevant optional suggestions separately without reducing 100%. No completion points depend on public visibility, newsletter consent, MFA, paid features, membership renewal or permission changes. Current-member and alumni rubrics are intentionally different and not a public comparison.

Render a private compact progress card on portal overview and the admin home/self-profile screens. Only supply percentage, generic field labels, states and safe links to client components. Missing-field hints must not serialize student IDs, email values, phone numbers or protected profile data before password unlock. Identity corrections link to the existing reviewed editor; ordinary updates retain current-password verification. Restricted/deleted/unlinked profiles retain their existing access state, without a misleading 0% card. Advisors are outside this first rubric.

Admin MFA guidance has four truthful conditions: authenticator not configured when positively known; configured but current session needs verification; current native AAL2; state unavailable/unknown. Enrollment and session assurance remain separate. Reuse setup/challenge routes and the existing seven-day snooze. List only existing permitted operations, with all remaining requirements explained. Admin-role invitation/change/removal requires native AAL2, current password and the exact session/intent-bound proof. Completion and MFA never award permissions.

## Concrete user journeys and presentation rules

- Member/alumni home: one compact “Profile completeness” card shows percentage and completed/applicable checks. Keep main portal tasks prominent. Show up to three missing core items and a “Review profile” link; at 100%, use “Applicable details complete” and keep optional details separate.
- Selecting a missing item opens the existing editor. Missing phone/workplace parts link to direct editing; workplace offers the explicit applicable/not-applicable choice only after unlock. If password unlock is required, keep the current verification screen first; only focus the requested field after successful unlock. Links carry a generic field identifier, never a field value, email or token. A pending identity correction shows “Under review” and links to its existing status instead of encouraging a duplicate submission.
- Admin home/self-profile: show own admin completion separately from linked member completion. Keep one existing MFA reminder, with an expandable explanation of permitted operations; do not duplicate it with a second global banner or suggest that a TOTP creates permissions.
- Suggestions refresh from canonical saved data after successful save/approval. Do not optimistically award points for an upload attempt or request submission. When data cannot be verified, keep ordinary dashboard work available and show “Completion unavailable” with a safe retry.
- Admin activity: add a view within the existing audit explorer. Offer actor/action/outcome/date filters and a 25-row default page. Wide screens may use a table; phones must expose all key fields in stacked rows/detail disclosure without page overflow. Show timestamp in Asia/Dhaka, source/coverage and last collected time. Stale collection is visible, not a fake “no activity” result.
- Activity summaries use factual labels: “Last workspace access”, “Last completed action”, “No workspace access observed for six months” or “History unavailable”. Invitation pending and never-used-since-activation are different conditions. These are not an HR or online-presence report.
- Security notices use an unread indicator and a dedicated inbox/list within the admin workspace. No forced modal or auto-navigation when a notice arrives. Mark-read is an explicit owned POST/action, not a side effect of fetching the page. Opening a stale or unauthorized link shows the normal permission response.
- Scoring remains advisory: it does not make phone/workplace mandatory for account access, ordinary profile saves, intake or membership approval. Phone and workplace stay private according to existing field/projection rules and visibility choices; do not expose them because they are now scored.
- Serious mutations keep the existing accessible confirm/cancel interaction explaining what changes. These notices add no CAPTCHA and no redundant confirmation to ordinary profile edits or read-only logs.

**Timing contract:** application-owned committed invitation/role actions are eligible for panel notice creation immediately when the release's notice consumer is installed. An existing request may make one bounded delivery attempt after commit; the daily job recovers pending work. Native password/MFA evidence can arrive later and is only announced after verified capture; disclose the daily fallback and collection time. Account-holder password mail should use the supported native immediate security-email setting if verified available. No delivery-time or realtime-presence guarantee is invented.

**Contract gate for later AGY work:** publish safe DTOs for completion/next-step state, session-aware dashboard guidance, account-level scheduled guidance, activity items/coverage, summaries and notices. Include available/unavailable/pending/denied/suppressed fixtures. Client components render server decisions; they never receive Auth factor material, full event JSON, proofs, role-edit authority or private profile values.

## Release 2: trusted activity and retention

### Evidence model and access

Add private server-owned normalized activity events, a small per-admin summary and ingestion/coverage state. These are projections of verified sources, not replacements for existing audit records. Preserve the current audit viewer and add an Admin activity view/filter within it.

Each event includes stable ID, source ID, actor/target identifiers, action, outcome, timestamp and allowlisted context. Never accept actor identity, outcome or timestamps from a browser. Distinguish successful mutation, denied/failed attempt, observed workspace access and unknown provider outcome. Existing browser-writable/uncorroborated legacy rows are labelled as legacy evidence and cannot establish attendance or successful duty work.

Use actual committed application outcomes for invitations, grants, moderation, content, bulk and other admin mutations. Map current handlers into a reviewed event catalog before instrumentation; do not change their business behavior. For transactional database operations, persist the event in the same transaction or reuse its trusted committed receipt. For external Auth operations, reconcile actual native outcomes; never report failure/success merely from a button click.

Record admin-destined sign-in and successful admin-workspace entry separately. Required MFA must finish before a workspace entry is successful. Password rechecks, token refreshes, background requests and public/member-only visits are not admin logins or duty work. Ongoing sessions can update a coarse last-workspace-access summary at most once per admin per UTC day on an authenticated workspace page render, excluding known prefetch/background/API requests. This records observed page access, not proof of human attention or online presence; do not track mouse/keyboard activity. Logout is logged only when actually observed, not when a browser window closes.

Supabase provider audit events supplement application evidence and cover actual native password changes. Enable/verify database audit capture before relying on it, using supported provider settings. Do not add triggers to provider-owned auth tables or expose auth tables/RPCs to browser roles. Store a coverage start and interruptions. Provider and application events with no reliable common identifier stay separately labelled; do not merge by approximate timestamps or double-count them as completed work.

### IP, country and device

Record provenance separately from the value. Vercel may observe the Cloudflare edge rather than the visitor. A supplied CF-Connecting-IP or CF-IPCountry is not trusted simply because the hostname is jnuits.org.bd. Verify both the custom-domain and directly reachable deployment paths before using visitor metadata.

Use verified visitor information where available; otherwise show the observed proxy/edge address as such and visitor country as unavailable. No paid Trusted Proxy service, new Worker, per-login geolocation API, precise GPS, device fingerprint or raw unrestricted user-agent storage is included. Parse bounded user-agent input into coarse browser/major version, OS and device class; it is client-reported evidence, not physical identification.

Audit readers need admin.audit.read. Full network detail requires admin.audit.read plus admin.security.read; ordinary views mask IPs and exports omit network details by default. Cross-account activity on the Admin Accounts screen additionally preserves admin.admin_profiles.manage and existing target-visibility restrictions. Self summaries expose only that user's own evidence. Recheck current permissions near each read/export; revoked/disabled accounts cannot retain access through cached projections.

### Retention and inactivity

Keep new event details for at least three calendar months. Do not delete/shorten existing audit, security or verification history. Define an indexed cutoff and bounded cleanup for only the new projection; first production purge requires a reviewed dry-run and explicit activation of that retention policy. Imported events also have at least three months from ingestion before their new projection is purged.

Keep compact first/last sign-in, last workspace access and last completed work, with source/coverage evidence, for the admin-account lifetime. Purge these non-network summaries three calendar months after permanent account removal/deletion, unless an explicit incident hold applies. This is separate from detailed-log retention; a frozen account is not permanently removed. Retain monotonic ingestion cursors and bounded deduplication evidence so purge cannot resurrect notifications or events. Prefer durable source high-water marks; retain individual replay keys only for sources that cannot provide safe monotonic checkpoints.

States: invitation pending; never used the admin workspace (only with uninterrupted coverage since access activation); not seen for six calendar months (only when reliable coverage supports it); seen recently; history unavailable. Last meaningful completed work is a separate date/count, not a productivity score. Existing accounts without reliable history start as history unavailable. Missing events are not proof of inactivity. Six-month calculation uses calendar months in Asia/Dhaka, not a fixed 180-day approximation. No automatic role/lifecycle change.

## Release 3: security notices and monthly recommendations

### Notice policy

| Completed event | In-panel audience | Email policy |
| --- | --- | --- |
| Native admin-account password change/reset | Active eligible audit readers | Verified account holder gets a security notice; peers only with explicit security-email opt-in |
| Admin invitation created/accepted/revoked | Active eligible audit readers | Opted-in eligible peers; invitation delivery to the invitee remains the existing distinct workflow |
| Admin access/role changed or removed | Active eligible audit readers | Opted-in eligible peers; no permission changes caused by the notice |
| MFA factor changed | Active eligible audit readers, only for verified native completion | Opted-in eligible peers; no codes, keys or factor material |
| Routine login, page read or content edit | Audit view | No peer broadcast email |

A notice says who, what, when and links to a permission-checked screen. It does not include passwords, tokens, invitation URLs/codes, QR/setup keys, full IPs, sensitive profile values or another recipient's address. For peer notices, recheck active admin identity/audit permissions at enqueue, read and send; content admins without audit permission do not inherit it from a notification. Essential account-holder email instead checks the affected verified Auth account and provider suppression, without requiring peer audit permission or optional email opt-in.

Native user_updated_password provider events are the single canonical source for password-change broadcasts/notice delivery; application password handlers may add safe context but must not produce a second broadcast. Provider-only notifications can be delayed until ingestion (target: within 24 hours when the daily job is healthy). Keep unknown actor information unknown. Confirm whether native Supabase password-security email is already enabled; use one account-holder delivery owner, not both native and application copies.

Account-holder security mail is bound to the affected verified Auth account, including when that person changes its password through a member/alumni portal; it does not require that person's audit-read permission. Peer notices still require active audit permission. A password-change attempt or recovery request alone never creates a successful-change notice.

Use private recipient-bound notices and a durable delivery ledger. Deduplicate by event/recipient/channel, and by account/month for digest generation, with rubric version recorded as metadata. Resend idempotency is an extra short-lived safeguard, not the durable monthly guarantee. Preserve bounced/complained suppression and current transactional credentials/sender: JnUITS <no-reply@jnuits.org.bd>. A notification delivery failure never repeats the underlying mutation or blocks a successful password change.

Add explicit optional peer-security and recommendation email preferences, default off for existing/new users. Essential account-holder security notices are separate from optional recommendation opt-outs. Respect verified-email availability and provider suppression even for essential delivery.

### Monthly recommendations and free-tier operation

Generate at most one digest per admin per Asia/Dhaka calendar month, only with useful next steps: own incomplete profile, account-level authenticator setup guidance, and permitted duty queues. A scheduled job has no live browser session and must never construct an AdminVerificationActor, claim current AAL2 or ask the recipient to verify an imagined session. Dashboard verification guidance remains based on the actual current session. Limit to three next steps; no unrelated queues or another user's private details. Always offer personal panel guidance even when email is opted out. A fully complete/protected account with no applicable recommendation receives no empty email.

Use deterministic templates, not an AI-generated recurring process. Release 2 introduces one ordinary daily Vercel job for bounded provider ingestion and collection health, so its audit coverage is independently operational. Release 3 extends that same job with delivery retry and due monthly digest work; it does not introduce a second schedule. Current Hobby docs support daily execution with hour-level timing; function quotas still apply. Before enabling it, verify account quotas, remaining capacity and CRON_SECRET privately. No new paid plan or Codex heartbeat.

Initially run an operator-controlled dry-run and disposable-delivery rehearsal. Default limits: up to 500 source events read per batch, 100 accounts evaluated, ten emails sent per invocation, at most one provider request per second, and a 20-second work budget. Checkpoint and continue on later invocations; security delivery takes priority and monthly runs may span several days. Enqueue current-month recommendations on/after day one; never retroactively send every missed historical month. Expose backlog, coverage and last successful job state; do not silently claim timely delivery after a failed job.

Permanent validation/permission/suppression failures are not retried. A possibly accepted send with an unknown outcome is retried only within the provider's idempotency window or after verified reconciliation; beyond it, surface operator attention instead of risking duplicate mail. Restart/retry tests must prove concurrency safety, durable deduplication and no duplicate confirmed delivery.

## Delivery, ownership and acceptance

Planned split: Codex owns field rules, evidence, authorization, private data, APIs/RPCs, providers, migrations, CI, integration and release decisions. AGY will own assigned presentation components, accessible interaction, responsive/theme behavior, focused frontend tests and sanitized browser evidence. Codex freezes the safe view-model contracts and supplies disposable fixtures before dependent AGY work starts. AGY will not recalculate permissions/scores/inactivity, change API/migration/provider contracts, merge or deploy.

The owner approved the design. Separate Codex tasks, documented view-model contracts and a Gemini frontend prompt/checklist are prepared with exact paths, base SHA, ownership exclusions and return-evidence format. The owner will provide the prompt to Gemini; no other chat is messaged automatically. Native Codex backend implementation remains the recommendation, with one focused independent integration review per release and no repeated whole-branch reviews.

Order: Release 1 first; Release 2 supplies trusted events/summary; Release 3 consumes those contracts. Each release has its own plan below and can ship after its own required gates. Later source receipts/contracts cannot be assumed before they are implemented.

Required checks at execution: relevant behavior/component tests, permission/RLS tests, clean SQL replay for new migrations, full unit/component suite, lint/typecheck/build, credential/dependency/access/UI audits, migration integrity/order/parity, and three-engine release/production smoke. Browser mutations use disposable environments. Production checks are non-mutating except normal authorized authentication; owner performs designated consenting-mailbox acceptance.

Verify exact PR head and all required non-Vercel gates before normal merge; verify post-merge main and actual production SHA/smoke before declaring a release complete. If CI fails, reproduce its failing tests locally before another GitHub run. Use the bounded local read-only CI helper, never restore the cancelled ten-minute AI schedule.

Keep earlier owner-mailbox, encrypted-backup/recovery/storage and separate authenticated production acceptance gaps open with their own evidence. This plan does not close them or reopen unrelated deferred committee work.

## Release and later handover readiness

Readiness gates for Codex/Gemini execution:

1. Confirm the completion rubric and user-visible labels, the permission-scoped notice audience, and the collection/delivery timing contract.
2. Agree and document the server view-model shapes, representative fixture states, exact presentation paths and integration base SHA. Codex implements/finalizes these contracts in the backend tasks before dependent AGY integration. No component may silently replace missing backend evidence with hardcoded production data.
3. Establish the Codex backend worktree, AGY frontend worktree and one tested integration branch for each release. Integrate all accepted frontend/backend commits for that release before final checks and merge; neither side changes the other's files without coordination.
4. Give AGY a bounded prompt covering JnUITS styling, the existing form-control heights/dropdowns, accessible progress/filters/inbox/preferences, loading/error/pending states, mobile/tablet/desktop light/dark checks and evidence return. No SQL, providers, permission decisions, merge or deployment authority.
5. Give Codex tasks covering pure rules, native session/account distinctions, permission-scoped loaders, source capture, migrations, jobs/delivery and final integration. Specify shared contracts before frontend-dependent work starts.

**Rollout behavior:** a failure of advisory completion/guidance data shows an unavailable state without blocking existing permitted work. Authentication/permission/assurance failures still fail closed. New audit/notice views show an honest not-ready/collection-unavailable state while legacy audit functionality remains available. Apply backward-compatible forward SQL before enabling dependent application contracts; a code rollback preserves accumulated private events rather than dropping tables. Collection and email delivery have separate activation switches so a mail failure cannot disable logs.

**Notice cutover:** record the start of notice delivery. Historical/backfilled events stay visible in permitted audit history but never create retroactive unread broadcasts or email floods. Monthly jobs consider only the current month. An operator may review an older event explicitly; ingestion alone is not authority to mail its subjects.

**Evidence needed to call a release complete:** exact tested frontend/backend/integration revisions, behavioral/RLS and three-engine results, meaningful unavailable/denied states, hosted migration/grant receipts where relevant, actual production SHA and its smoke results. Logging additionally needs first successful collection/coverage receipts; email needs consented mailbox/suppression/retry evidence. Local transport or screenshot fixtures do not close those production acceptance gates.

## Execution artifacts

- [Gemini frontend prompt and checklist](../../operations/2026-10-14-gemini-frontend-accountability-handover.md)
- [Frontend view-model contracts](../../operations/2026-10-14-profile-admin-accountability-frontend-contracts.md)
- [Codex execution checklist](../../operations/2026-10-14-codex-accountability-execution-checklist.md)

## Plans and current provider references

1. [Profile completion and MFA guidance](../plans/2026-10-14-profile-completion-and-mfa-guidance.md)
2. [Admin activity and retention](../plans/2026-10-14-admin-activity-and-retention.md)
3. [Admin security notifications and digest](../plans/2026-10-14-admin-security-notifications-and-digest.md)

Provider references checked on 2026-10-14:
- [Supabase Auth audit logs](https://supabase.com/docs/guides/auth/audit-logs): database storage is optional; authentication events include password changes and token refreshes.
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa): factor enrollment and verified session assurance are distinct.
- [Vercel request headers](https://vercel.com/docs/headers/request-headers) and [Cloudflare headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/): determine provenance before using forwarded network metadata.
- [Vercel Cron usage](https://vercel.com/docs/cron-jobs/usage-and-pricing): Hobby daily/hour-level scheduling and function usage.
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys): provider keys expire after 24 hours; application deduplication must last longer.
