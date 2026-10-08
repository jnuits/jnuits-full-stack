# Theme First-Paint FOIT Elimination Verification Report

- **Date / Timestamp:** 2026-10-08T03:26:29.697Z
- **Branch:** `codex/audit-theme-first-paint`
- **Base Commit:** `ef343895d143a37098a173698e730aac25bc39e9` (contains owner README commit `57824e93640fb57983bc0cfa4f37cd9a5131db63`)
- **Execution Target:** Local Next.js 16.3.8 Turbopack Production Server (`http://127.0.0.1:3100`)
- **Total Probes:** 24
- **Passed Probes:** 24 (100.0%)
- **Failed Probes:** 0
- **Observed FOIT Flashes:** 0
- **CSP Violations:** 0
- **Unhandled Page Errors:** 0

---

## 1. Production HTML & CSP Contract

- **Nonce Injection:** Confirmed. Next.js App Router injects server request nonce into `<head><script nonce="...">`.
- **Script Position:** Directly inside `<head>` before `<body>` content parsing.
- **Strict Dynamic CSP:** Verified. Header contains `script-src 'self' 'nonce-...' 'strict-dynamic'` with **zero** `unsafe-inline` or `unsafe-eval`.
- **Zero Unnonced Scripts:** Verified. All executable inline scripts match the document request nonce.

---

## 2. Matrix Verification Results

| Browser | Viewport | Scenario | Expected | Pre-Hydration DOM | Post-Hydration DOM | Toggle `aria-pressed` | Result | Screenshot |
|---|---|---|---|---|---|---|---|---|
| `chromium` | `desktop` | `stored-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [chromium_desktop_stored-dark.png](./screenshots/chromium_desktop_stored-dark.png) |
| `chromium` | `desktop` | `stored-dark-delayed-hydration` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [chromium_desktop_stored-dark-delayed-hydration.png](./screenshots/chromium_desktop_stored-dark-delayed-hydration.png) |
| `chromium` | `desktop` | `stored-light` | `light` | `light` (no-dark) | `light` | `false` | PASS | [chromium_desktop_stored-light.png](./screenshots/chromium_desktop_stored-light.png) |
| `chromium` | `desktop` | `system-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [chromium_desktop_system-dark.png](./screenshots/chromium_desktop_system-dark.png) |
| `chromium` | `desktop` | `system-light` | `light` | `light` (no-dark) | `light` | `false` | PASS | [chromium_desktop_system-light.png](./screenshots/chromium_desktop_system-light.png) |
| `chromium` | `desktop` | `storage-denied-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [chromium_desktop_storage-denied-dark.png](./screenshots/chromium_desktop_storage-denied-dark.png) |
| `chromium` | `mobile` | `stored-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [chromium_mobile_stored-dark.png](./screenshots/chromium_mobile_stored-dark.png) |
| `chromium` | `mobile` | `stored-dark-delayed-hydration` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [chromium_mobile_stored-dark-delayed-hydration.png](./screenshots/chromium_mobile_stored-dark-delayed-hydration.png) |
| `chromium` | `mobile` | `stored-light` | `light` | `light` (no-dark) | `light` | `false` | PASS | [chromium_mobile_stored-light.png](./screenshots/chromium_mobile_stored-light.png) |
| `chromium` | `mobile` | `system-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [chromium_mobile_system-dark.png](./screenshots/chromium_mobile_system-dark.png) |
| `chromium` | `mobile` | `system-light` | `light` | `light` (no-dark) | `light` | `false` | PASS | [chromium_mobile_system-light.png](./screenshots/chromium_mobile_system-light.png) |
| `chromium` | `mobile` | `storage-denied-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [chromium_mobile_storage-denied-dark.png](./screenshots/chromium_mobile_storage-denied-dark.png) |
| `webkit` | `desktop` | `stored-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [webkit_desktop_stored-dark.png](./screenshots/webkit_desktop_stored-dark.png) |
| `webkit` | `desktop` | `stored-dark-delayed-hydration` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [webkit_desktop_stored-dark-delayed-hydration.png](./screenshots/webkit_desktop_stored-dark-delayed-hydration.png) |
| `webkit` | `desktop` | `stored-light` | `light` | `light` (no-dark) | `light` | `false` | PASS | [webkit_desktop_stored-light.png](./screenshots/webkit_desktop_stored-light.png) |
| `webkit` | `desktop` | `system-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [webkit_desktop_system-dark.png](./screenshots/webkit_desktop_system-dark.png) |
| `webkit` | `desktop` | `system-light` | `light` | `light` (no-dark) | `light` | `false` | PASS | [webkit_desktop_system-light.png](./screenshots/webkit_desktop_system-light.png) |
| `webkit` | `desktop` | `storage-denied-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [webkit_desktop_storage-denied-dark.png](./screenshots/webkit_desktop_storage-denied-dark.png) |
| `webkit` | `mobile` | `stored-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [webkit_mobile_stored-dark.png](./screenshots/webkit_mobile_stored-dark.png) |
| `webkit` | `mobile` | `stored-dark-delayed-hydration` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [webkit_mobile_stored-dark-delayed-hydration.png](./screenshots/webkit_mobile_stored-dark-delayed-hydration.png) |
| `webkit` | `mobile` | `stored-light` | `light` | `light` (no-dark) | `light` | `false` | PASS | [webkit_mobile_stored-light.png](./screenshots/webkit_mobile_stored-light.png) |
| `webkit` | `mobile` | `system-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [webkit_mobile_system-dark.png](./screenshots/webkit_mobile_system-dark.png) |
| `webkit` | `mobile` | `system-light` | `light` | `light` (no-dark) | `light` | `false` | PASS | [webkit_mobile_system-light.png](./screenshots/webkit_mobile_system-light.png) |
| `webkit` | `mobile` | `storage-denied-dark` | `dark` | `dark` (.dark) | `dark` | `true` | PASS | [webkit_mobile_storage-denied-dark.png](./screenshots/webkit_mobile_storage-denied-dark.png) |

---

## 3. Key Findings & Proof of Resolution

1. **Pre-Hydration 0ms Theme Application:**
   In all dark scenarios across Chromium (149) and WebKit (26.5), `document.documentElement` carries `data-theme="dark"` and `class="dark"` at `DOMContentLoaded` **prior** to client hydration.
2. **Delayed-Hydration Immunity:**
   Under artificial 300ms client chunk delay, the document renders and maintains dark styling continuously without any intermediate reset or flash to light.
3. **Resilience & Storage Denial Fallback:**
   When `localStorage` access is denied (throwing `SecurityError`), the synchronous head script and the client `ThemeToggle` gracefully fall back to the system preference (`prefers-color-scheme`).
4. **Hydration Reconciliation:**
   React 19 hydration reconciles without emitting hydration warnings, without resetting the DOM theme to light, and correctly synchronizes the `aria-pressed` attribute of `ThemeToggle`.
