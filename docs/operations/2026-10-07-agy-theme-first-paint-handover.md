# AGY handover: eliminate the initial theme flash

## Scope and starting point

Implement the focused frontend correction identified in Settled Run 2. Preserve JnUITS styling. This is implementation and targeted verification, not another whole-project audit or another report-only pass.

Fresh verified main: `57824e93640fb57983bc0cfa4f37cd9a5131db63` (owner README update). Codex is separately fixing the smoke test's placeholder Sentry transport on `codex/audit-browser-fixture`; coordinate only if touching `e2e/nonce-csp.spec.ts`. Fetch and record the current base before starting. Work on a separate `codex/audit-theme-first-paint` branch in the existing frontend worktree if clean; preserve existing commits, ignored ledgers, primary checkout probes, screenshots, and owner files. Never reset or delete them to start this task.

Read AGENTS.md, the approved audit plan/handover, current layout and theme toggle, and installed Next.js guides for preventing flash before hydration, CSP, and server/client rendering before coding.

## Required behavior

1. Apply the stored `jnuits-theme` preference, or system preference if absent/invalid, before the first content paint on full document visits. Keep client navigation and the toggle working.
2. Use the server-provided request nonce on any synchronous head script. Keep the strict production CSP, dynamic rendering and per-document nonce contract. Never add unsafe-inline/unsafe-eval or an unnonced script. Keep the existing nonce provider and other root classes.
3. Accept only `light` and `dark` stored values. If localStorage reads throw, still apply the system theme. If writes throw, keep the toggle usable for the current document; subsequent resolution must not immediately undo that choice. Cover storage-denied and invalid-value cases.
4. Keep root `data-theme` and `.dark` consistent. Reconcile hydration without a post-hydration light reset. Handle development remounts and system-theme changes consistently with explicit saved preferences.
5. Keep accessible toggle state, keyboard behavior, skip-link focus and a single main landmark intact.

The report's proposed script is a starting idea, not an approved implementation: its broad catch skips system-theme fallback when storage is denied, and it accepts arbitrary saved values. `suppressHydrationWarning` alone does not guarantee correct behavior.

## Tests and evidence

- Add focused behavior tests for stored light/dark, no preference with each system theme, invalid storage, blocked storage and functional toggling. Show the meaningful failing case before the fix.
- Test actual production-build HTML with the request nonce; preserve the current nonce/CSP execution tests and error assertions. Exercise Chromium, Firefox and WebKit in supported environments. Report unsupported host dependencies instead of marking skipped browsers passed.
- Measure before paint, not merely after DOMContentLoaded or after React settles. Use paint-aware instrumentation and a deliberately delayed hydration case to establish that content starts in the requested theme. Record first-paint/FCP support limits per engine. Do not claim zero-millisecond flash from the Run 2 settling timer.
- Verify hydration errors, client navigation, toggle, actual light/dark screenshots at mobile/tablet/desktop sizes, focus and overflow. Save new evidence separately from both historical runs.
- For any live probe, resolve the exact custom-domain deployment and SHA afresh with explicit project/team scope. Fail closed on unresolved metadata, mismatched SHA or ambiguous CLI output; never substitute a hardcoded deployment, commit message, or old SHA. Verify at start and finish.
- Turnstile hook creation is not proof of SDK rendering. Separate hook declared, SDK hook active, render call and callback counts. Evaluate token presence as a boolean inside the page; never transfer token values or widget identifiers to receipts. Owner alone completes real CAPTCHA/mailbox steps.
- A monitored request count proves only its monitored scope. Prefer context-wide fail-closed same-origin application-write guards, explicitly classify approved telemetry, and report any unmonitored scope. Do not exercise real production mutations.

## Return and boundaries

Return frontend commits, exact base/tested SHA, finding-to-commit mapping, commands and exit codes, screenshot paths and sanitized paint/CSP/hydration receipts. List any remaining limits honestly.

Do not merge, deploy, apply SQL, modify providers/headers, send mail, change real requests/roles/factors, or run authenticated mutations. Codex owns integration and release. Real newsletter/native AAL2/current-password acceptance, backups, provider-owned default ACLs and cleanup remain open independently.
