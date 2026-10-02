# Admin verification and bulk membership review design

Date: 2026-10-02 (Asia/Dhaka)
Status: policy approved in conversation; written specification awaiting review. Product code and hosted authorization are not changed by this document.

## Purpose and approved decisions

JnUITS administrators must be able to process routine membership requests without an extra MFA barrier. Encourage MFA adoption without disrupting that work. Keep sensitive actions verified and give administrators who have never enabled MFA an email-code alternative when mandatory MFA is disabled.

The owner's explicit exception is that admin-role changes require **both authenticator MFA and current-password verification**. Email OTP must never substitute for either requirement in that class. Other currently protected actions, including security-policy changes and retention operations, may use the email alternative under the policy below.

This extends the earlier bounded membership-review change into a shared authorization feature. It does not implement the deferred committee/onboarding master-plan phases or approve any real member request automatically.

## Repository and hosted findings

- Base: `origin/main` at `2c0b876` (README-only production trigger following PR #163).
- `src/lib/auth/mfa.ts` returns success without checking actual assurance when `admin_totp_enforced` is false. The setting must no longer stand in for proof that MFA was verified.
- `src/lib/auth/session.ts` and `src/lib/admin/api-auth.ts` use that helper for action protection. Route layouts and `src/lib/supabase/proxy.ts` also use MFA controls. A layout or proxy check is not sufficient protection for a standalone mutation.
- `private.require_membership_operator()` insists on AAL2 independently of settings. Both request review and renewal confirmation use it, although they need different action policies.
- Hosted read-only inspection found mandatory MFA disabled, 109 migration-history entries and no pending, unexpired admin invitations. These are dated observations, not permanent invariants.
- Existing Resend transport is `src/lib/notifications/send-email.ts`; it returns delivery failure rather than throwing. An OTP flow must await and check that result, never grant access merely because the transport call returned.
- `/api/profile/step-up` already checks a current password with a separate non-persistent Supabase client. Its 15-minute, user-bound profile cookie is not session/action-bound and must not become the admin-role authorization proof.
- Browser writes to `rbac_user_platform_roles` are already revoked. Preserve that boundary; existing member/alumni portal-role changes are not admin-role changes.

## Policy matrix

Every operation requires a verified signed-in user, an active administrator profile and its existing permission. Verification never grants a missing permission or bypasses target-role rules.

| Action class | Mandatory MFA off | Mandatory MFA on |
| --- | --- | --- |
| Routine membership request reviews, including bulk approval | Permission checks and explicit review confirmation; no action-level MFA/OTP challenge | Normal mandatory admin MFA applies; no additional review-specific challenge |
| Other protected action, administrator has enabled MFA | Verified authenticator session; challenge if not verified | Verified authenticator session |
| Other protected action, administrator has never enabled MFA | Offer MFA setup or a scoped email OTP | Authenticator enrollment and verification; no email bypass |
| Admin-role change | Verified authenticator MFA **and** action-bound current-password proof | Verified authenticator MFA **and** action-bound current-password proof |

Do not change the existing global setting automatically. Reading the setting, permission, assurance or enrollment state unsuccessfully must not create an authorization success. A global-policy change or an MFA enrollment during a pending email challenge invalidates that fallback.

### Action classification

- Routine: approve/reject existing-member Alumni, departure and departure-appeal requests through the existing reviewed transition. Retain review notes, consequences, expected timestamps and frozen-access preservation.
- Protected: office renewal payment/waiver confirmation; security-setting changes; retention archive/approval/purge operations; existing protected security/health read scopes; admin-account freeze/unfreeze; admin-invitation cancellation. Preserve all existing evidence checks and permissions.
- Admin-role: grant, change or revoke an admin-scope role, remove an admin account's roles, and issue an invitation that authorizes a future admin-role grant. Check both factors at the mutation boundary regardless of global enforcement.
- An accepted invitation redeems the issuer's previously verified, immutable authorization for that particular recipient and role. It is not a new unrestricted role-management operation by the recipient. Bind issuance proof to the invitation and preserve existing recipient, expiry, linked-member and claim checks. Legacy invitations without this evidence require authorized reissuance; never fabricate a verification record.
- Portal member/alumni role replacement remains within its existing guarded workflow. Do not make normal Alumni conversion require admin-role password verification.
- Audit other application writers of admin-scope roles during implementation. A second UI, helper or RPC must not provide an alternative around the dual-verification rule. Operational bootstrap scripts remain separate, trusted server-side procedures, not a browser fallback.

Centralize these classifications in an explicit action registry. New protected operations must choose a policy rather than silently inherit a permissive default. Do not redesign unrelated routine CMS/member workflows in this change.

## Shared verification architecture

Separate three questions: may this account enter the admin workspace, does it have permission for this operation, and has it supplied the proof required for this operation?

Use common server-side policy evaluation for rendered pages, server actions, API routes and database RPC boundaries. Read actual assurance even with mandatory enforcement disabled so voluntarily enrolled MFA continues to work and the security page shows accurate status.

The registry binds each proof to an operation identifier, permission, user, verified Supabase session, canonical target and a digest of the intended payload. The server computes these bindings from validated input and trusted authentication, not client-selected role/actor metadata. Changing the target, role, payment resolution, policy value or retention operation requires new proof.

Sensitive page reads can use a five-minute, session-bound proof restricted to their named read scope. It does not authorize writes. Mutation proofs are single-use and restricted to one exact mutation. Avoid consuming a mutation proof during page rendering or routine refreshes.

Use server-owned challenge/proof records in a private schema with explicit ACLs and defense-in-depth RLS. Browser roles cannot read, create, verify, amend or directly mark these records consumed. Narrow service-only issuance/verification routines are called only after the application has verified the operator and session. Authenticated mutation RPCs derive their actor from `auth.uid()` and validate proof bindings themselves.

Consume mutation proofs atomically with a database mutation when both live in Postgres. Existing service-backed or external Auth operations must atomically reserve their proof before side effects; failed/uncertain attempts require re-verification or existing idempotency reconciliation, never restoration of a reusable authorization token. Preserve role-version invalidation, target restrictions and last-super-admin protection.

No new trusted claims in user-editable `user_metadata`; no fake `aal2`, weakened anonymous grants, exposed service secrets or table-level browser bypass. Do not change Supabase-managed Auth schemas to implement this feature.

## Email OTP flow

1. Validate same-origin/authentication, active-admin permission, current policy, intended operation and fallback eligibility. Resolve the recipient from the authenticated, confirmed Auth email; do not accept a recipient address from a form.
2. Generate a cryptographically random six-digit code. Store only a keyed digest bound to the challenge/user/session/operation/payload; use the existing application MAC key infrastructure and support its rotation. Never store or log the clear code or put it in a URL.
3. One pending challenge per user/session/operation. A replacement invalidates the earlier code. Challenge lifetime is five minutes, with at most five failed attempts. Resend cooldown is 60 seconds, with at most three sends per 15 minutes per account and an additional IP limit. Account limits span operations and sessions so changing targets does not bypass them.
4. Persist limit/attempt state and enforce it atomically; production must not fall back to an unbounded process-local limiter. Delivery errors still count toward throttling and leave no usable proof.
5. Send through the developed Resend transport and await success before making the challenge verifiable. A verified code is consumed once. Issue the exact-operation proof with at most five minutes of validity, not a workspace-wide unlock.
6. At redemption recheck active status, permission, same live session, confirmed/unchanged email, policy and enrollment eligibility. Reject expired, reused, different-user/session, mismatched-target and newly ineligible proofs.
7. Record issuance/delivery failure/verification outcome and operation audit metadata without passwords, codes, proof secrets or full email bodies.

Email verification is not Supabase authenticator assurance. Do not implement this as a new email sign-in that silently replaces the current session or turns the JWT into AAL2. Show `Verify by email` rather than `Bypass MFA`.

Remember confirmed MFA enrollment server-side and seed existing enrolled accounts from trusted factor state/history. Removing factors must not make a previously enrolled account count as one that has never enabled MFA. Unknown enrollment history requires enrollment or the existing authorized recovery process, not an automatic email downgrade.

## Admin-role password verification

- Require a real verified authenticator session, independent of mandatory enforcement and any email proof.
- Verify the operator's own current password using the existing Supabase password-sign-in approach, a separate non-persistent client and the configured CAPTCHA protection. Check the returned user matches the signed-in operator and clean up the temporary session without signing out or replacing the existing MFA session.
- Limit password checks to three attempts per ten minutes per operator, with an additional IP bound. Failure cannot create a proof. Passwords never enter cookies, logs, audit payloads or database storage.
- Successful password proof lasts at most five minutes and is bound to the original verified session, exact target and intended admin-role operation. Consume it once at the operation boundary. The ordinary profile-edit cookie is never accepted instead.
- MFA-only, password-only and email-OTP-only requests all fail for this class. Wrong password, target/payload change, expired/reused proof, revoked admin status and stale permissions also fail before role writes.
- Accounts without a usable password must establish one through the developed account-recovery/password workflow and enroll MFA before performing admin-role changes. Do not add an email-only recovery shortcut for granting roles.

## Bulk membership approval and adoption UI

- Add accessible per-row checkboxes, an indeterminate `Select all on this page` checkbox, a selected count and `Approve selected`. Select at most the 25 visible reviewable requests in one queue; never select hidden pages or office-payment/waiver rows.
- Reset selection on queue/page changes. On refreshed data, discard resolved or changed snapshots and keep only unchanged, still-pending requests selected. Missing-timestamp, successfully resolved or otherwise non-reviewable rows cannot be selected. During submission disable changes to the selection and duplicate submissions.
- Show the selected members, request type, consequences, one shared required review note (maximum 500 characters) and explicit confirmation before submitting. Keep individual review and rejection available; bulk rejection is outside this request.
- Validate the complete payload before starting any writes: one to 25 unique request IDs, current expected timestamps, one allowed request type matching the queue, note and confirmation. Verify request types server-side rather than trust client labels.
- Reuse the existing per-request transaction and its permission/stale-state checks; process the bounded batch in a deterministic order. Each successful decision remains individually auditable. Report approved, already approved, stale/ineligible and failed results separately. Partial failure is not an all-success result and must not roll back previously successful approvals by issuing inverse transitions.
- Refresh affected admin/portal views and clear only resolved selections; retries preserve timestamps and idempotency semantics. Never advance renewals, lift a security freeze, invent a joining date or send new claim invitations through bulk review.
- Show a small in-app `Protect your admin account — enable MFA` suggestion when enrollment is missing, with a setup link and dismiss/snooze option for seven days. Do not block routine work, repeatedly email administrators, expose security jargon or claim MFA is verified when enforcement is merely disabled.
- Preserve existing theme and responsive patterns. Challenges/dialogs must support focus management, keyboard controls, narrow screens, pending/error states and return to the original operation without losing its draft.

## Code boundaries

Keep responsibilities separate rather than enlarging existing action files unnecessarily:

- Shared policy/operation registry, session/assurance resolver and verification-proof helpers under `src/lib/auth/` with focused unit tests.
- Same-origin protected admin verification endpoints under `src/app/api/admin/`; reuse existing Auth, CAPTCHA, rate-limit and Resend infrastructure.
- Reusable admin verification/adoption components under `src/components/admin/`; integrate with membership dialogs, admin-account operations, security settings and retention workflows.
- Preserve and update guards in `src/lib/auth/session.ts`, `src/lib/admin/api-auth.ts`, `src/lib/admin/access.ts`, `src/lib/supabase/proxy.ts` and existing action callers. Update the source-based AAL2 tests to assert the new explicit policies, with behavioral tests that prove those policies are enforced.
- Forward-only SQL migrations for private challenge/proof state, narrowly granted routines and reviewed membership RPC protection; no edits to already-applied migration files. Keep generated database types and the security-definer function register current.

The implementation plan will define exact interfaces and task-by-task red/green tests after this specification is reviewed. Do not install new dependencies merely for OTP generation, hashing or email transport.

## Acceptance and rollout gates

1. Policy tests cover mandatory on/off, verified/unverified enrollment, unavailable state and previously enrolled accounts. Permission denial always wins over any proof.
2. Server/API/Postgres tests demonstrate routine AAL1 reviews when enforcement is off, denial to ordinary members/inactive admins, sensitive-action verification, and admin-role MFA-plus-password enforcement. Direct RPC calls cannot bypass these rules.
3. OTP/password tests exercise attempt/resend limits, delivery/configuration failures, expired/reused/cross-session proofs, email changes, role revocation, policy/enrollment races, changed targets and concurrent redemption. Audit/log assertions confirm no credential material leaks.
4. Bulk tests cover select/unselect/all/indeterminate state, empty/over-limit/duplicate/mixed requests, required confirmation, individual timestamps, partial results, already-reviewed retries and unchanged frozen access.
5. Real local Next.js/Supabase browser tests use disposable users/data at 360px and 1440px in both themes. Verify entry, sensitive reads/writes, CAPTCHA preservation, back-to-operation navigation and role-change controls. Transport fixtures prove behavior but do not certify production mailbox delivery.
6. Run the full repository suite, typecheck, lint, production build, admin-access/UI audits, credential-hygiene checks, migration ordering, clean replay and SQL behavioral assertions. Take a whole-patch security/code review before hosted rollout.
7. Apply only the verified forward migration SQL through the Supabase plugin. Reconcile exact migration versions/history; check function bodies, ACLs, denial paths, advisors and unchanged mandatory-setting value. Do not approve a real request or change a real role merely to verify deployment.
8. Push/review through the established GitHub workflow when implementation is ready; distinguish GitHub Actions from the separate Vercel account/deployment restriction. Verify the deployed application uses the matching authorization migration before claiming production completion.

## Scope and review checkpoint

Authorized: this policy, membership-request bulk approval, developed Resend reuse, admin-role dual verification and necessary forward Supabase authorization changes. Not authorized by this design: changing the live enforcement setting, granting/revoking real roles, approving real Alumni/departure requests, deleting the backup branch, or resuming deferred committee features.

Next checkpoint: review this written specification. After approval, create and review the implementation plan before product-code or hosted changes.
