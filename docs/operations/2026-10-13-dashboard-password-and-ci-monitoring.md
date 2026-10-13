# Dashboard passwords and CI completion monitoring

## Authenticated dashboard policy

On 2026-10-13 the owner confirmed that CAPTCHA must remain on public login and
must not appear inside any authenticated dashboard. The portal profile unlock,
portal password change, admin password retry and admin-role password dialog
follow this policy. Public login, registration, password recovery, email
verification and public submission protection are unchanged.

Every private password endpoint validates the original session and same-origin
request, applies durable attempt limits, and verifies the current password with
Supabase Auth. A fresh server-only client uses the trusted key to bypass public
login CAPTCHA. The submitted email cannot select another account, the returned
identity must match the validated session, and temporary sessions are closed
locally. Tokens and keys are never returned to the browser.

Portal password change uses the verified user's native `updateUser` operation,
not an administrative password reset. Profile unlock remains scoped to the
existing 15-minute HttpOnly cookie. Neither operation creates native AAL2.
Admin-role operations still require native AAL2 **and** current-password proof,
with current policy/permissions checked and the proof bound to the original
session and exact intent. Email proofs cannot replace native MFA or rescue an
invalid session. See [Supabase Auth CAPTCHA middleware](https://github.com/supabase/auth/blob/master/internal/api/middleware.go).

The admin verification API accepts an ignored, bounded legacy CAPTCHA token and
returns a disabled CAPTCHA configuration for already-open older application
versions. New dashboard clients have no widget or token dependency.

## Browser acceptance and reload diagnostics

The disposable Auth harness enables native public CAPTCHA, proves that a
CAPTCHA-free public sign-in is denied, and checks dashboard flows with the
provider widget script blocked. Its trusted seed creates only fictional users;
subsequent claims must have the authenticated user role. It never changes hosted
users, roles, factors or passwords. Required CI reuses one isolated production
build for the admin assurance suite, profile self-service suite, and member
editor browser matrix.

WebKit can emit a native access-control diagnostic for queued Next.js prefetches
from a document being discarded by hard reload. The production smoke test
preserves these as `retired-document-prefetch-diagnostics` only from reload start
until the new main document commits, only in WebKit, only for the same origin's
`_rsc` URL, and only for the observed native error shape. Active-document errors,
JavaScript exceptions and other fetch failures still fail. The outgoing and
incoming documents' enforced CSP violations are checked separately. Menus,
certificate fields and local validation are exercised before and after reload.
Public admin and portal login smoke also require the CAPTCHA input to exist.

## Read-only Actions completion helper

Prerequisites: Node 24 and an authenticated `gh` CLI with repository read access.
The helper makes only GET requests to GitHub. It does not approve environments,
rerun workflows, merge, deploy, or change provider statuses.

```powershell
node scripts/watch-github-actions.mjs --sha FULL_40_CHARACTER_COMMIT_SHA --notify
```

To launch independently from the AI session, in the intended worktree:

```powershell
$taskSha = (git rev-parse HEAD).Trim()
$taskRepo = (Get-Location).Path
New-Item -ItemType Directory -Path artifacts/reports -Force | Out-Null
$taskWatcher = Start-Process -FilePath (Get-Command node).Source `
  -ArgumentList @("scripts/watch-github-actions.mjs", "--sha", $taskSha, "--notify") `
  -WorkingDirectory $taskRepo -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput "artifacts/reports/ci-watcher-$taskSha.log" `
  -RedirectStandardError "artifacts/reports/ci-watcher-$taskSha.err.log"
$taskWatcher.Id
```

The default interval is 60 seconds, with a one-hour timeout. Run one watcher per
commit at a time. It deletes only its previous exact report for that validated
SHA on restart, then saves one terminal JSON report under
`artifacts/reports/ci-completion-<SHA>.json`. Generated evidence remains ignored.
Use `--production` when production smoke must appear before success;
`--interval-seconds 10..300` and `--timeout-minutes 1..240` are bounded overrides.

Success requires all configured workflows for the exact SHA: Quality Gate,
Diff Check, Semgrep and CodeQL. Any production smoke run already found for that
SHA is included. Attempt timestamps order reruns even when they keep an older
run ID; any active required rerun keeps the report waiting. Newer failed attempts
supersede older green runs. Missing workflows,
queued/in-progress checks, skipped/cancelled runs and API errors cannot yield
success. A failure or approval wait ends monitoring early and is reported for
attention. Optional Windows notification is best effort; JSON is authoritative.

| Exit | Meaning |
| --- | --- |
| 0 | Required Actions succeeded |
| 1 | A watched Action failed or did not succeed |
| 2 | Action/environment needs attention |
| 3 | Bounded wait timed out |
| 4 | API, arguments or local report storage unavailable |

Provider statuses are reported separately. Vercel's pending “Waiting for checks
to complete” status does not mean an Actions runner is still executing. A
completed report is evidence to inspect, not permission to bypass a release
gate. Before merging, verify the PR still has the same head and inspect all
required non-Vercel checks. Verify the actual production deployment SHA and
production smoke after release. A README edit is unnecessary merely to refresh a
stale provider status when the deployment is already READY.

## Confirmation-overlay follow-up

Required CI exposed an unstable/intercepted admin-role confirmation click before
password verification. Viewport confirmations now render outside the caller's
fieldset and scroll layout, preserving the same buttons and confirmation before
verification. Opening focuses Cancel, Tab/Shift+Tab stay within the dialog, and
dismissal restores the opener. Native disabled submitters cannot be bypassed.
Product styles, public CAPTCHA and authorization are unchanged.
The disposable role scenario also constrains the local form while its viewport
confirmation is open and still exercises cancellation, an uncertain network
outcome and single-use native AAL2/password proof.

The native admin scenarios mutate shared synthetic membership/role fixtures.
Automatic Playwright retries are disabled only for this serial suite because
replay requires a fresh disposable stack; rerunning already-reviewed requests
is not a valid retry. All scenarios and Linux browser release gates remain
required. A new workflow run creates fresh fixtures.
