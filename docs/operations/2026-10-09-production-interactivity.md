# Production interactivity incident and release checks

## Confirmed cause

On 2026-10-09 the owner reported inert Chrome navigation controls and a missing certificate input, while localhost worked. Production served Vercel deployment `dpl_8gfKhx1etbTMAk6FHBsRyCzW8veX` at Git revision `c1bbcd1da7a9c6437fc4baafad8bf61380ad1e1d`. Its application code matches PR #173; only the README changed afterward.

The owner changed the apex DNS record from Cloudflare proxying to DNS-only. Fresh Chromium checks then passed. To identify the cause, a separate public, anonymous browser used a local DNS override to the existing Cloudflare endpoint, without modifying public DNS. That response rewrote 19 scripts to non-executable Rocket Loader types. Chrome blocked the unnonced Rocket Loader and email-decode scripts under the site's nonce/strict-dynamic CSP. The hamburger stayed `aria-expanded=false` after a click. The direct Vercel path hydrated normally. This establishes a delivery-layer script transformation failure, rather than an independent menu implementation defect.

The certificate input was present in the reproduced response. Its absence in the owner's original session was not independently captured; stalled hydration/stream insertion is consistent with the shared failure. Do not claim that the exact missing-input state was reproduced.

The current `www` hostname still resolves through Cloudflare but returns a 307 redirect to the DNS-only apex. It does not serve the application HTML. Verify this redirect after domain changes.

The connected Cloudflare integration is the owner's personal account. It returned no matching JnUITS zone; no provider settings were changed. JnUITS account access is needed only if the owner later wants Codex to inspect or change zone configuration.

## Patch

- Nonced document responses retain private/no-store behavior and add `Cache-Control: no-transform`, asking intermediaries to preserve HTML and script execution order. Static assets, API responses, and RSC requests retain their existing caching behavior.
- The existing build-time public Sentry release supplies `X-JnUITS-Release` only when it is a 40-character Git SHA. The deployed-domain check verifies this header against the expected revision.
- Production CSP remains nonce-based and does not permit script `unsafe-inline` or `unsafe-eval`.
- Generated frontend acceptance folders and Playwright's generated status file stay local rather than repeatedly appearing in Git changes. Previously committed sanitized evidence remains tracked.

`no-transform` is defense in depth. It does not override explicit incompatible provider rules or prove that an untested CDN configuration is safe.

## Free-tier operating configuration

Keep the application hostname DNS-only pointing to the Vercel target shown in its domain settings. Cloudflare can remain the authoritative DNS provider; Turnstile does not require website proxying. No paid hosting features are needed for the patch or checks.

Before enabling Cloudflare proxying again, disable Rocket Loader and Email Address Obfuscation for application HTML. Disable other HTML/script rewriting features and audit Workers, Snippets, transform rules, and cache rules. Respect origin private/no-store/no-transform directives; do not Cache Everything on application HTML, authenticated routes, APIs, or RSC responses. Preserve Next.js RSC/prefetch headers and `_rsc` query parameters. Purge previously transformed HTML after an intentional configuration change, then run the public-domain smoke check. Avoid weakening CSP to make a loader execute.

Cloudflare documents Rocket Loader's script deferral and CSP requirements: [Rocket Loader](https://developers.cloudflare.com/speed/optimization/content/rocket-loader/). It documents `no-transform` and HTML rewriting: [response body inspection](https://developers.cloudflare.com/rules/configuration-rules/response-body-inspection/), [origin cache control](https://developers.cloudflare.com/cache/concepts/cache-control/). Installed Next.js guidance is in `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` and `cdn-caching.md`.

## Release checks

The required Quality Gate adds `e2e/public-interactivity.spec.ts` to its production-build Chromium/Firefox/WebKit suite. This catches application regressions before merging, using isolated fixtures.

`Production Browser Smoke` runs the same suite against `https://jnuits.org.bd` after a successful Production deployment status from `vercel[bot]`. It checks the public domain, not an event-provided URL, and uses reviewed test code from main. It also supports manual dispatch on main after a DNS/CDN change:

~~~powershell
gh workflow run production-browser-smoke.yml --ref main
~~~

The suite checks fresh matching nonces, no-transform, release SHA, desktop menus, mobile hamburger/submenus, certificate field/empty-input validation after client navigation and reload, theme switching, newsletter input/unchecked consent, gallery search, contact fields, and both login forms. It captures page exceptions and document CSP violations. Blocked scripts fail; optional Vercel Toolbar frame violations remain visible in evidence. Live WebKit also reports a specific Turnstile iframe same-origin denial; that exact diagnostic is retained separately and does not certify CAPTCHA acceptance. All other page exceptions fail. Requests that would submit application data are blocked, with the existing telemetry transport allowed. It performs no login, certificate lookup, email delivery, factor changes, or database mutations.

Runs need browser dependencies and normal public HTTPS access only; no application credentials, Vercel token, database secret, or paid deployment gate. Evidence is retained as GitHub artifacts for 14 days. Existing fixture checks do not replace provider/mailbox/native-MFA acceptance.

This post-deployment check detects regressions and marks a release incomplete; it does not prevent Vercel from initially assigning the domain or roll back automatically. A failed check requires investigation, DNS/CDN correction or the supported owner deployment process, and a successful rerun before release closure. Do not promise that tests eliminate every future regression.

## Verification record

- Root cause: Cloudflare-path script rewriting and CSP rejection reproduced without public DNS changes.
- Header regression test failed before the patch and passed afterward.
- Exact release-header regression test failed before implementation and passed afterward.
- Fresh local production build: 8 public interaction checks passed in Chromium before the release-identity addition; final checks are recorded in the execution ledger and PR.
- Live direct-domain browser acceptance and final non-Vercel CI results are recorded in the execution ledger and PR. The hardened header and exact release check need the new production deployment before they can pass live.

## Remaining scope

Preserve the old audit acceptance backlog: owner mailbox/native-assurance checks, provider-owned Supabase default ACLs, encrypted backups/restore/media recovery, performance evidence, and safe release cleanup remain separate. This incident does not authorize provider account changes or close those acceptance gaps.
