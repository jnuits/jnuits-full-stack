# Theme remediation integration — 2026-10-08

This record supplements [remaining audit acceptance](2026-10-07-remaining-audit-acceptance.md). It covers the focused AGY theme patch and Codex integration; provider, identity and recovery acceptance remain separate.

## Source and production baseline

AGY delivered three commits on `codex/audit-theme-first-paint`, ending at `07e3ed1037524f6b492ab86bb6fd68ecfb7a5683`, based on the owner README commit `ef343895d143a37098a173698e730aac25bc39e9`. Codex integrated them onto `codex/audit-theme-integration` from that verified remote main, preserving AGY's branch and historical artifacts.

Fresh, explicitly scoped Vercel alias/deployment lookups now agree: `jnuits.org.bd` serves READY deployment `dpl_nwgTUo9EdfLjSUx6XRpvwi6SHsui`, Git SHA `ef343895d143a37098a173698e730aac25bc39e9`. This supersedes the older custom-domain deployment gap. The theme patch requires a subsequent production release and fresh SHA verification.

## Resulting behavior

The request-nonced synchronous head script applies validated stored light/dark preferences before body parsing, with system fallback for absent, invalid or denied storage. Hydration reconciles from the client source in a layout effect, preserving the bootstrapped theme rather than briefly reapplying the light server snapshot. A denied write retains the choice for the current document and client navigation. Missing media-query APIs preserve functional toggling. Existing root classes, nonce provider and strict script CSP remain intact.

## Validation and preserved evidence

The original AGY tests passed but missed a same-task light-to-dark hydration reset because MutationObserver callbacks saw the final value. Its instance-level storage spies also failed to intercept jsdom Storage calls. Prototype-level mocks and synchronous class-call capture establish meaningful regressions: 20 of 22 tests passed and two failed on AGY's code, for the hydration reset and unguarded media-query subscription. Both pass after correction. Local full Vitest: **2,060 tests across 313 files passed**; lint and typecheck passed. Production build passed with disposable public/content database fixtures.

The preserved AGY 24-case JSON, report and screenshots remain unchanged in `artifacts/theme-first-paint-evidence/`. The primary copy differs only in line endings. Its `testedCommit` is a branch label, and its DOMContentLoaded sampling plus 300ms delay does not establish first-paint or exact-build provenance. Its reported 2,054-test total is not used as final acceptance evidence. DOM execution tests establish synchronous changes; jsdom does not paint.

The integrated browser suite holds **all client script requests** until visible-frame samples and a screenshot are captured, then releases hydration and checks theme transitions, runtime errors and CSP. It covers explicit preferences against the opposite system theme, both system defaults, invalid/denied storage, a bootstrap-removal negative control, successful persistence and quota-denied writes across actual client navigation. Intermediate attribute values are retained rather than hidden by batched observer delivery. Test setup is limited to the top document: a targeted WebKit probe showed inherited about:blank child frames could otherwise reseed localStorage after an actual pointer/keyboard toggle, creating false test failures. The isolated probe proved both interactions preserve the selected preference.

Chromium must supply FCP timing during the held interval. Other engines record available entries and explicitly annotate unavailable or unobserved FCP. WebKit advertises Paint Timing but provided no FCP during the held interval on this Windows host. Its screenshot also waited indefinitely for fonts.ready while document loading was held: pre-hydration capture uses Playwright's narrowly scoped font-wait control, recording the rendered page without releasing JavaScript; normal post-hydration captures retain normal font waiting. Frame/screenshot observations are not a universal zero-millisecond claim.

Required Linux CI now includes the nine theme scenarios in Chromium, Firefox and WebKit, alongside existing smoke/CSP/transport checks. Successful runs retain structured results and theme screenshots/receipts for 14 days. The standalone `node scripts/verify-theme-first-paint.mjs` performs a fresh isolated production build, records HEAD/tree/tracked diff hash/build ID, refuses an occupied or ambiguous port and source changes, preserves failure exits, and writes a new timestamped folder under ignored `artifacts/reports/`. It never overwrites historical evidence or reuses an unidentified server. Optional Playwright project arguments allow supported local engines; Firefox remains required on Linux CI.

Use the final PR's required checks and immutable CI revision as release evidence. Do not merge on local test results alone. No SQL changed, so this patch requires no new migration or provider settings change.

## Outstanding acceptance

- Verify the actual production SHA and live theme/CSP behavior after the supported owner deployment process.
- Owner completes genuine CAPTCHA, newsletter mailbox/confirmation/preferences/unsubscribe and native AAL2/current-password/stale-session checks. Fixtures and declared hooks cannot close these.
- Resolve the pending owner choice for optional production Vercel Toolbar behavior without weakening CSP.
- Complete Supabase-provider-owned default ACL correction through the supported provider procedure.
- Provision encrypted database backup settings; prove independent ciphertext recovery and an isolated restore, and separately recover media bytes. A skipped scheduled backup is not a recovery point.
- Measure a defensible rendering/performance comparison if claiming a rendering-cost change.
- Preserve all execution ledgers, owner documents, worktrees and `backup/pre-ai-it-fest-2026`; defer release cleanup until its own outstanding evidence is complete.

No additional AGY implementation or repeat whole-project audit is needed for this patch. Any later AGY task should target a specific remaining browser acceptance gap.
