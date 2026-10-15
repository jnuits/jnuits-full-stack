# Accountability integration validation
Gemini delivered local commits bc17ace, 91efc4b, 896d771 and ee4ae3b from a49460e. They were merged locally into codex/profile-admin-accountability; main is unchanged.

The reported 37 DOM tests across nine suites were independently reproduced. The screenshot source is a standalone HTML fixture; its mobile Release 1 image contains undefined completion counts. The earlier return report's integrated-browser/recheck boxes are not accepted as integration evidence. Real production-mode disposable Auth/database/browser acceptance is being run by Codex.

Corrections found during integration:
- A configured factor was incorrectly described as satisfying AAL2; guidance now distinguishes enrollment from a verified native session.
- A void React form action reset edited fields after failed saves. A failing regression test reproduced this; native prevented submit preserves edits and an immediate ref lock prevents duplicate sends.
- Activity table omitted the shared responsive table class required by the existing zero-budget UI gate. The class is adopted; the gate is unchanged.

No production email delivery, continuous Auth audit coverage, or later release is claimed by this report. Backend contracts, migrations and exact revision receipts remain the release owner's responsibility. Existing mailbox/backup/recovery gaps stay open.

Release 1 local verification after the focused review: 2,396 tests across355files (includes34 Release2 pure tests); lint, typecheck and production build passed. The reviewed Release1 focused regressions passed35/35. Native production-mode disposable acceptance passed the existing profile/password/review scenario plus six completion scenarios across Chromium/WebKit, including linked admin home/self-profile cards. Windows Firefox is unavailable due missing UCRT; Linux CI retains all three engines and is still required.

The single focused review found three P2 issues; all were reproduced and fixed in one pass: refreshed canonical workplace applicability, accessible self-service MFA navigation for unknown enrollment, and separately owned linked member/alumni completeness with unique accessible heading IDs. No new permission grant or forced account linking was introduced.

Linux CI subsequently exposed shared disposable IP buckets; an executable regression reproduced the real429, and fixture resets now isolate those buckets while keeping the production durable limiter unchanged. A later Linux WebKit run passed saves/scores but failed on departing-document RSC cancellation pageerrors. A minimal same-origin HTTP/WebKit experiment reproduced that exact engine behavior: a stable request succeeds, while a request started during document replacement never reaches the server and reports access control. The test-only collector accounts for this only with the exact engine signature, same scheme/host/port, a portal UI RSC path and a pending main-frame replacement. Active-document, API, foreign-origin, CSP and hydration errors remain fatal. See [Playwright43120](https://github.com/microsoft/playwright/issues/43120). This is not a claim that all WebKit network errors are harmless or that Linux CI has passed.
