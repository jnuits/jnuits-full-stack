# Profile completion, admin security guidance and activity roadmap

Status: future work requested by the owner on 2026-10-14. These features are not implemented or enabled by the member-card presentation release. Each phase needs its own reviewed design, acceptance criteria and release evidence.

## Current member-card release

Show current public EC position labels instead of the Member/Alumni badge. Restore the classification badge when no eligible current public EC appointment remains. Enlarge directory portraits and initials from 48 to 80 pixels diameter and match their loading placeholder. This changes presentation only; membership classification, profile visibility and portal permissions keep their existing meaning.

The supplied workbook contains 20 responses but 19 distinct people. Srizon Saha appears in rows 9 and 18 with the same membership ID. The live 7th EC therefore has 19 appointments against its configured target of 21. Office Secretary and one additional Executive Member target seat remain vacant. Never create a duplicate member or inflate the count to fill those seats.

## Phase 1: profile completion and next steps

- Show a 0–100% completion indicator and a short list of missing details to the signed-in member or alumnus, with links to the existing relevant profile fields.
- Define one server-owned, versioned completion rubric from meaningful profile fields. Decide weights and required fields in the phase design. Count only valid persisted data. Omit fields that do not apply to the account; private information can be complete without being public.
- Public/private choices, newsletter consent, optional social accounts and authenticator enrollment must not be coerced to achieve 100%. Profile completion does not confer permissions or bypass review.
- Preserve current-password unlock for ordinary self-service edits and the reviewed workflow for full name, JnUITS ID, email, university student ID and department. Avoid displaying protected profile values before password unlock; a recommendation can identify a missing category without exposing its contents.
- Give administrators comparable personal-profile suggestions, using their own profile and existing self-profile boundaries.

Acceptance: deterministic scores for empty, partial and complete fixtures; correct not-applicable handling; no public leak or cross-account data; working next-step links and accessible responsive progress controls. No repeated client database reads just to compute a score.

## Phase 2: accurate authenticator guidance

- Explain the verified TOTP setup flow and the operations the current admin's existing permissions allow once the required native session assurance is met.
- Describe authenticator verification as satisfying an assurance requirement. It does not award a new role or expose capabilities outside existing permissions. Admin-role changes and invitation issuance still require native AAL2, current-password verification and the exact session/intent-bound operation proof.
- Keep routine membership-review behavior consistent with optional MFA enforcement. Separate verified factor enrollment from a session currently at AAL2.
- Reuse existing setup/challenge routes, enrollment evidence and snoozable guidance. Never classify legacy unknown accounts as never enrolled. Scoped email OTP cannot replace native AAL2 or repair an invalid session.

Acceptance: role-specific suggestions under enforcement on/off, no permission escalation, no unnecessary dashboard CAPTCHA, and truthful stale-session/error states. Keep CAPTCHA on public forms and login.

## Phase 3: admin security and action history

- Extend the existing audit explorer behind `admin.audit.read`, rather than creating a second unrelated log viewer. Authenticate and authorize near each read, including exports.
- Record successful sign-in, sign-out where observable, password-change completion, admin invitation lifecycle, role changes and actual privileged action outcomes. Distinguish failed attempts, successful completion and uncertain outcomes. A password recheck is not a new workspace login; a token refresh is not meaningful duty activity.
- Normalize provider Auth audit events and application audit events into a bounded private projection. Verify current Supabase Auth audit storage settings and event schemas before relying on them. Never expose `auth` tables directly to the browser.
- Show actor account, timestamp, relevant target/action/outcome, IP, approximate country and coarse device/browser/OS when supported by trusted evidence. Record unavailable values as unknown. Country estimates and user-agent descriptions do not prove a person's location or physical device.
- Establish the trusted Cloudflare-to-Vercel request path before accepting forwarded headers. Do not trust arbitrary `CF-Connecting-IP`, `CF-IPCountry` or client-supplied headers on a directly accessible origin. Avoid third-party geolocation calls on every login.
- Keep event details for at least three calendar months, with explicit bounded retention and indexes. Retain a small per-admin last-successful-login/activity summary beyond six months so the inactivity report can work after detailed events expire. Existing longer audit retention must not be shortened by this feature.
- Do not store passwords, OTPs, invitation codes, recovery codes, setup keys, cookies, access/refresh tokens, complete request bodies or unnecessary personal profile values. Protect audit integrity from ordinary admin edits/deletions. Preview retention effects before approved deletion.

Acceptance: permission/RLS coverage; trusted-header spoofing tests; idempotent event ingestion; bounded filtered queries; sanitized exports; minimum retention; and accurate known/unknown evidence. Record verified provider coverage start instead of inventing historical events.

## Phase 4: security notifications

- After a password change or another admin invitation actually succeeds, create an in-panel notification for eligible administrators and optionally a transactional email according to the approved recipient and delivery policy.
- Use the existing Resend delivery/outbox patterns with stable event IDs, retries and suppression handling. Avoid duplicate notifications, per-recipient address disclosure or automatic marketing subscriptions.
- Include who performed the action, what happened and a safe admin-panel link. Include no password, invitation code or recovery material. Clarify who can receive/read each event before implementation; email access must not broaden audit permissions.
- Treat the account holder's essential security notice separately from optional recommendations. Honor applicable opt-outs for optional emails; delivery failures remain visible and retryable without repeating the underlying action.

Acceptance: one successful action produces one event per eligible recipient; failure/cancellation produces no false success notice; idempotent partial-delivery recovery; authorized panel visibility; and owner-controlled real-mail acceptance.

## Phase 5: activity summaries and monthly recommendations

- Show last successful workspace login and last meaningful completed work, with separate statuses for never signed in since creation, inactive for at least six calendar months, and activity history unknown. Existing accounts without reliable historical coverage remain unknown.
- Present factual dates and counts. Avoid labeling a person idle merely because they keep an existing session open, work offline, are on leave, lack relevant duties, or perform work outside this site. Monthly recommendations support the operator; inactivity does not automatically revoke access or roles.
- Send a compact monthly recommendation email through one idempotent monthly job, with an account-specific checklist, timezone and per-account/month deduplication. Start with an approved operator-run batch if a reliable free scheduler is unavailable. No recurring Codex/AI heartbeat is required.
- Bound database/email work, respect provider quotas, document costs and recovery, and keep recipient preferences and suppression behavior intact.

Acceptance: creation/acceptance versus first-login semantics; reliable six-month thresholds even with three-month detailed-log retention; legacy unknown states; preference-aware delivery; monthly retry without duplicate mail; and no unauthorized access change.

## Optional later phase: contribution XP

An XP/ranking scheme needs a separate decision after reliable activity evidence exists. Prefer a private contribution summary first. If approved, credit deduplicated, authorized, completed useful work with reviewed weights and caps. Do not reward login counts, password changes, repeated edits, security-sensitive approvals, invitations or role changes just to increase a score. Account for reversed work and different admin duties. Rankings never grant permissions, weaken MFA, decide removals or automatically shame inactive accounts.

## Existing foundations and references

- Public title eligibility: `src/lib/committee/current-titles.ts` and its server loader.
- Self-profile boundaries and MFA policy: `docs/operations/admin-verification.md` and `src/lib/admin/admin-profiles.ts`.
- Permission-scoped audit explorer: `src/lib/admin/audit-explorer.ts`.
- Optional notification preferences and mail delivery: `src/lib/notifications/preferences.ts`, `send-email.ts` and `resend-webhook.ts`.
- [Supabase Auth audit logs](https://supabase.com/docs/guides/auth/audit-logs): provider sign-in/password events and configurable database storage.
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa): native enrollment and session assurance.
- [Vercel request headers](https://vercel.com/docs/headers/request-headers) and [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/): verify edge provenance before using IP/country headers.

No database migration, provider-setting change, outbound recommendation email, XP award or monitoring schedule is authorized by saving this roadmap alone. Keep earlier mailbox, encrypted backup/recovery and separate authenticated production acceptance gaps open.
