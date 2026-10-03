# Administrator verification and membership review

Implementation policy approved on 2026-10-02. This guide describes the new
boundaries; it is not evidence that the branch has been deployed. Rollout
evidence belongs in the implementation plan.

## What administrators see

| Operation | Mandatory MFA disabled | Mandatory MFA enabled |
| --- | --- | --- |
| Existing-member Alumni, departure and appeal reviews | Permission, review note and consequence confirmation | Normal authenticator workspace verification |
| Renewal payment/waiver, security policy, retention, account freeze/unfreeze and invitation cancellation | Authenticator verification; confirmed-email code offered only to trusted never-enrolled accounts | Authenticator verification only |
| Admin-role changes, removals and invitation issuance | Authenticator **and current password**, with configured CAPTCHA | Same dual verification |

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
email HTTP transport and the CAPTCHA widget transport are fixtures. Document
responses retain the real content-security policy with the exact disposable
localhost Auth origin added to `connect-src`; production headers are unchanged.
Application
CAPTCHA-required configuration and missing-token denial remain enabled. This
proves code/session handling, **not hosted CAPTCHA or mailbox delivery**.
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
