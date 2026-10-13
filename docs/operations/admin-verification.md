# Administrator verification and membership review

Implementation policy approved on 2026-10-02. This guide describes the new
boundaries; it is not evidence that the branch has been deployed. Rollout
evidence belongs in the implementation plan.

## What administrators see

| Operation | Mandatory MFA disabled | Mandatory MFA enabled |
| --- | --- | --- |
| Existing-member Alumni, departure and appeal reviews | Permission, review note and consequence confirmation | Normal authenticator workspace verification |
| Renewal payment/waiver, security policy, retention, account freeze/unfreeze and invitation cancellation | Authenticator verification; confirmed-email code offered only to trusted never-enrolled accounts | Authenticator verification only |
| Admin-role changes, removals and invitation issuance | Authenticator **and current password**; dashboard CAPTCHA is not required | Same dual verification |

Voluntary authenticator enrollment continues to work when enforcement is off.
Email verification never upgrades a session to AAL2, grants a permission or
unlocks the whole workspace. Security settings, system health and retention
have separate five-minute read scopes. Mutations use one exact, single-use
proof; changing the target or details requires verification again.

The existing enforcement setting is not changed by rollout. Missing or stale
account/session/permission/policy evidence denies access. Previously enrolled
accounts cannot remove their factor to become eligible for the email option.
Unknown historical enrollment requires authenticator setup or authorized
account recovery, not an assumed "never enrolled" classification. Legacy
invitations without verified issuance must be reissued by an authorized admin.

## Authenticator setup and sign-in

Keep JnUITS styling while using the familiar password, authenticator, return-to-work
sequence. Mandatory workspace MFA sends an account without a verified factor to
setup, and an enrolled AAL1 account to the challenge. Optional enforcement still
allows routine reviews at AAL1; protected operations apply their own verification.

Setup follows Supabase's native `enroll → challenge → verify` APIs. Scan the QR
code, or explicitly reveal the setup key for manual entry in a TOTP app (issuer
JnUITS, six digits, 30 seconds). Enter the current six-digit code to finish.
Successful setup/challenge also checks that the native session reached AAL2 before
continuing to the allowlisted original destination. A provider/network failure
shows a retryable error; it is never reported as completed enrollment.

The QR and manual key exist only in the mounted setup UI. Do not log, persist,
share, or capture them. Browser QA masks both in screenshots and disables traces.
Pending TOTP factors are discovered through `listFactors().data.all`, since
`data.totp` contains verified factors only. Cleanup never removes verified factors
or another MFA method. Previously enrolled and legacy unknown accounts retain
their existing recovery restrictions; email OTP cannot replace native AAL2.

References: [Supabase native TOTP flow](https://supabase.com/docs/guides/auth/auth-mfa/totp),
[GitHub QR/manual-key setup interaction](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication).

## Routine bulk review

Open Membership DB → the Alumni, departure or appeal queue. Select individual
requests or `Select all on this page` (maximum 25), choose `Approve selected`,
read the consequences, add one review note and confirm. Fees/waivers remain
individual protected actions, not bulk selections.

Results distinguish approved, already approved, changed, ineligible and failed
requests. Completed selections are cleared; unchanged failed selections remain
available. Queue/page changes clear selections, and refreshed or disappeared
requests must be selected again. Successful earlier decisions are not undone
by a later failure. Independent security freezes, joining dates and renewal
payments are never changed by these request reviews.

## Challenge handling and recovery

Email codes last five minutes, allow five failed attempts, have a 60-second
resend cooldown and at most three sends per 15 minutes per account, plus IP
limits. Delivery failures count toward limits and cannot authorize an action.
Password checks allow three attempts per ten minutes per account, plus IP
limits. Passwords, clear codes and proof secrets must not enter logs, reports,
URLs or stored drafts.

Cancelling verification retains the mounted operation's draft. An MFA setup
suggestion is non-blocking and can be snoozed for seven days. The standalone
setup/challenge return destination is allowlisted.

A lost submission response also keeps non-secret form entries and releases
pending controls. The captured proof is discarded; a new protected submission
requires fresh verification. Check the actual record before retrying because
the first request might have completed. A bulk review refreshes the queue and
preserves its note without automatically repeating decisions. Normal Next.js
redirects still behave normally.

If a retention read expires while the workspace is open, verification reloads
only the authorized read. It does not repeat discovery, archive or purge. This
also applies when the read expires just after a successful mutation.

An invalid or out-of-date signed session cannot be repaired with an OTP for
that session. Security Settings, System Health and Data Retention instead show
`Sign in again` with the existing `Logout` control. Log out, sign in through
the normal admin login, then complete `Verify account` if prompted. This
refreshes genuine signed session/role evidence; it does not bypass permissions,
MFA or admin-role password verification. Unavailable verification services and
permission denials still fail closed, without offering an unusable challenge.

If an Auth/Drive operation reports an uncertain result, do not automatically
retry it, restore its proof or directly alter role/proof tables. Preserve the
attempt/job ID and investigate the actual Auth/Drive and database state through
an authorized operational recovery process. Pending freeze reservations are
treated as unsafe even after expiry; expired completion may require manual
reconciliation. This release does not add a general recovery UI.

## Verification and rollout

Run the full tests, typecheck, lint, production build, admin-access/UI audits,
credential guard, strict migration ordering and clean migration replay. The
replay includes real SQL authorization, race and bulk-transition assertions.
For browser integration, with Docker and installed Playwright Chromium:

```bash
node supabase/verification/run-admin-verification-browser-qa.mjs
```

The runner creates its own unlinked local Supabase project, real Auth users,
MFA factors and synthetic requests; it refuses remote/project arguments. It
starts real Next.js and exercises narrow/wide screens in both themes. Only
email HTTP transport is a fixture. The authenticated dashboard blocks the
CAPTCHA widget transport deliberately, while local native Auth requires CAPTCHA
for public sign-in. Trusted, isolated password verification still checks the
current password after validating the original session, native AAL2 (for role
operations), permissions and durable limits. Document responses retain the real
content-security policy with the exact disposable localhost Auth origin added to
`connect-src`; production headers are unchanged. This proves code/session
handling, **not hosted CAPTCHA or mailbox delivery**.
Credentials stay in memory; traces and automatic screenshots are disabled.
Non-secret page screenshots go to an external temporary directory. The normal
CI smoke run skips this suite unless launched by its disposable runner.

Before applying forward SQL, positively identify the JnUITS project, capture
migration history, current enforcement value and function ACLs, and complete
independent whole-patch review. Apply reviewed files with the Supabase plugin;
reconcile plugin-assigned versions without changing applied SQL bodies. Verify
history/parity, exact function definitions, ACLs, read-only denial paths and
advisors. Do not approve real requests or mutate real roles as a test.

GitHub Actions and the Vercel account restriction are separate gates. Do not
claim production completion until the deployed app matches the authorization
migrations. Keep the restoration backup branch untouched.

Do not apply the operation-guards migration independently to the old deployed
application: its legacy retention RPC loses service access, and its privileged
admin-role writers do not implement the new dual verification. Use a
coordinated matching-application cutover, or an explicitly authorized
maintenance window. Do not restore permissive compatibility writers.

Release hold recorded on 2026-10-03: the original development-only Next.js
ESLint chain failed the dependency gate on
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
The production-only audit is clean; upstream reports no patched braces
release. On 2026-10-03 the owner explicitly declined the proposed 14-day
exception and chose to keep the release blocked until patched. No exception is
implemented; all dependency checks remain required. The owner authorized a
coordinated maintenance cutover for the migrations and matching deployment,
but that cutover must wait for the dependency gate to pass. Do not apply the
incompatible operation guards to the old application while the release is held.

CI remediation on 2026-10-03 removes the vulnerable `fast-glob → micromatch →
braces` chain rather than excepting it. A private local adapter backed by pinned
`tinyglobby` replaces only the exact Next ESLint plugin's root-directory glob
API. Clean `npm ci`, a valid installed dependency tree, actual Next lint-rule
regressions and the unchanged production/development audit verify the fix.
See `scripts/vendor/next-eslint-glob/README.md` for its scope and upgrade/removal
contract. Upstream braces has not been declared patched. Merge still requires
green hosted CI; production authorization SQL still requires the coordinated
matching-app cutover and hosted-provider acceptance checks.

Rollout checkpoint (2026-10-04 Asia/Dhaka): PR #164 is merged; its PR/main
Actions passed. The owner-triggered production deployment on main `690eff5`
matches the reviewed application. The Supabase plugin then applied the three
reviewed migrations with versions `20261003181029`, `20261003181032` and
`20261003181035`. Local/hosted histories match at 112/112; all 44 selected
function bodies and their ACLs were verified, with SQL file contents unchanged.
Admin identity/role digests and mandatory-MFA enforcement remain unchanged.
The owner confirmed a fresh login followed by authenticator verification opens
Security Settings normally. Mailbox/CAPTCHA/provider acceptance is not inferred
from that confirmation or the disposable browser fixtures.

The advisor's 11 additional private-table "RLS enabled, no policy" notices are
intentional default-deny server-owned verification/authorization tables with
all direct browser/service grants revoked. Four added authenticated-definer
notices concern the registered, guarded role/security/invitation RPCs; renewal
is the existing guarded RPC with its new proof argument. Keep those explicit
authorization gates, rather than blindly revoking their intended entry points.
Existing advisor notices, including the free-tier leaked-password feature,
are unchanged; application-level compromised-password protection remains in use.

## Dashboard CAPTCHA policy (2026-10-13)

The owner explicitly approved removing CAPTCHA from every authenticated dashboard
while keeping public login protected. Portal profile unlock, portal password
change, admin password retry and admin-role password proofs follow this policy.
Role operations still require native AAL2 and current-password verification,
with exact-operation proofs bound to the original session and current policy.
Public login, registration, recovery, email verification, and public submission
CAPTCHA remain unchanged. An ignored legacy token and `required: false` response
are retained on the admin verification API for already-open older tabs.
