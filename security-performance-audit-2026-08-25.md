# Security & Performance Audit — jnuits-full-stack

> Historical audit input for the remediation branch. Status claims reflect the
> 2026-08-25 snapshot, not the final production verification. Personal and
> operational identifiers are intentionally omitted from this committed copy.

**Date:** 2026-08-25
**Scope:** Full repository (Next.js 16 App Router / React 19 / Supabase SSR auth / Vercel), 104 DB migrations, CI/CD, scripts, artifacts, git history, dependencies.
**Mode:** Read-only audit. No files were modified. All findings verified against source with file:line evidence. Secret values are never reproduced; personal identifiers masked.
**Method:** Six parallel domain audits (auth/session/admin, database/RLS, API routes + server actions, integrations/webhooks/uploads, CI/CD/secrets/supply-chain, frontend/performance), followed by direct personal verification of every High/Medium finding and all safe checks (typecheck, lint, tests, npm audit, git-history secret sweep).

---

## 1. Executive Summary

**Overall: PASS with conditions.** No Critical findings. The codebase is unusually well-hardened for this stack: DB-backed RBAC with JWT claim injection via a Postgres custom access token hook, per-action/per-route permission checks everywhere (CI-enforced access map), atomic race-safe registration/invitation RPCs, fail-closed CAPTCHA and rate limiting, timing-safe webhook verification, comprehensive Sentry scrubbing, SHA-pinned GitHub Actions, and a clean git history of credential material.

The audit surfaced **3 High, ~13 Medium, ~30 Low**, plus informational issues. The three that matter most:

1. **SEC-001 (High):** The global MFA kill-switch (`saveAdminSecuritySettings`) is protected only by the *page layout's* AAL2 check — server actions bypass layouts, so a stolen super-admin session cookie (no TOTP) can disable MFA enforcement platform-wide and unlock the entire admin surface. One-line fix.
2. **DB-001 (High):** Production still runs the pre-boundary `purge_retention_job`, which destroys PII for *every* submission of a form when one old record is approved. The fix migration (`20260726020000`) exists but is one of two documented-unapplied migrations.
3. **DB-002 (High, replay-only):** `membership_id_sequences` has no `ENABLE ROW LEVEL SECURITY` anywhere in the migration chain; live protection comes from a production-only event trigger. Fresh replays would expose the ID allocator.

Performance: the site-wide TTFB tax from unconditional middleware auth round-trips (PERF-001) and defeated ISR on the two highest-traffic pages (PERF-002) are the top ROI items; both have small, surgical fixes already supported by existing helpers in the codebase.

Hygiene: `npm audit` clean (prod + full), `tsc` and `eslint` pass, 1,087 vitest tests pass, git history contains no credential material. The main hygiene debt is committed operator reports containing plaintext invitation codes and super-admin identity data under `artifacts/reports/`.

---

## 2. Trust Boundaries

| # | Boundary | Controls observed |
|---|----------|-------------------|
| TB1 | Anonymous internet → public pages/APIs | Proxy matcher covers all non-static routes; same-origin enforcement (Origin-or-Referer allowlist, missing→403); per-endpoint rate limits backed by durable salted-hash Supabase store failing closed; Turnstile required whenever `VERCEL_ENV=production`; zod strict validation |
| TB2 | Authenticated member → portal APIs/actions | Supabase SSR session (JWT claims minted by `jnuits_custom_access_token_hook`); ownership resolved server-side via `user_id`; step-up HMAC cookie for sensitive profile edits; RLS as final backstop for mentorship/tickets |
| TB3 | Admin → admin surface | Layout AAL2 gate (`checkAdminMFA`, fails closed to *enforced*) + per-action `requireAdminPermission` + per-route `requireAdminApiPermission`; roles live in DB tables (not user metadata); `has_permission()` SECURITY DEFINER RPC re-reads DB on every permission-bearing operation |
| TB4 | Admin → destructive ops | Retention purge: `admin.retention.manage` + AAL2 + literal `"PURGE"` confirmation + HMAC-signed manifest whose boundary the RPC trusts; exports dual-permission-gated, audited, checksummed, `private,no-store` |
| TB5 | Third parties → webhooks | Resend: Svix timing-safe verification, ±5 min replay window, `whsec_` prefix enforced, fail-closed 503 without secret; idempotency via unique `provider_event_id` ledgers |
| TB6 | Browser → object storage | Cloudinary signed uploads: server-built folders, `allowed_formats` signed, HMAC proof bound to api secret with TTL, single-use sessions, post-upload Admin-API re-verification (forms); avatar path weaker (INT-001) |
| TB7 | CI → production | All prod-touching workflows are `workflow_dispatch`-only behind hard main-ref checks and protected GitHub environments; no `pull_request_target`; fork PRs see only placeholder env values |

**Key structural fact exploited by SEC-001:** Next.js server actions execute as standalone POST endpoints — **layouts do not run during action invocation**. Any control enforced only at the layout level is not a control for the action.

---

## 3. Findings

Severity: Critical / High / Medium / Low / Info. Confidence reflects verification strength. "Confirmed" = reproduced by direct code inspection or execution during this audit.

### 3.1 Critical

None.

### 3.2 High

#### SEC-001 — Global MFA enforcement can be disabled without step-up at the action level
- **ID:** SEC-001 · **Severity:** High · **Confidence:** High (**Confirmed**, personally verified)
- **Category:** Authentication / Authorization
- **Affected files:** `src/app/admin/settings/actions.ts:81–100` (compare `src/lib/auth/session.ts:473–480`, `src/lib/auth/mfa.ts:32–41`, page gate `src/lib/admin/access.ts:250–255`)
- **Evidence:**
  ```ts
  // actions.ts:82 — no requireAal2 option passed
  const auth = await requireAdminPermission("admin.security.write", { fallbackPath: "/admin/settings/security" });
  ...
  // :98 — disable direction gated only on role
  if (!parsed.data.adminTotpEnforced && auth.user.adminRole !== "super_admin") { ... }
  ```
  Four sibling privileged actions in `admin-profiles/actions.ts` (lines 849, 971, 1057, 1303) correctly pass `requireAal2: true` — this one was missed.
- **Impact:** Server actions bypass layouts. An attacker holding only a stolen super-admin **session cookie** (AAL1, no TOTP seed) is otherwise locked out of `/admin` by `checkAdminMFA`. This action lets them POST `adminTotpEnforced=false`, after which `is_admin_totp_enforced()` returns false for everyone and their AAL1 session unlocks the entire admin surface.
- **Root cause:** Layout-level AAL2 requirement mistaken for action-level protection; inconsistent application of the established `requireAal2` pattern.
- **Remediation:** Add `requireAal2: true` to this `requireAdminPermission` call. Consider requiring a second active super_admin or a reauth nonce to disable global enforcement. Grep all actions invoked from AAL2-gated pages for the same pattern (verified: everything else passes `requireAal2` or matches the access map).

#### DB-001 — Live `purge_retention_job` over-purges PII outside the retention boundary
- **ID:** DB-001 · **Severity:** High · **Confidence:** High (Confirmed via repo-documented state + migration diff)
- **Category:** Database / Data destruction (GDPR-over-deletion)
- **Affected files:** `supabase/migrations/20260722150000_retention_purge_rpc.sql` (live version) vs fix `20260726020000_retention_purge_boundary_enforcement.sql`; status documented in `supabase/verification/README.md`
- **Evidence:** The unapplied migration's header states the prior version "destroyed PII for EVERY submission of that form, including records created days earlier" (`update form_submissions set answers='{}', submitter_email=null … where form_definition_id = v_resource_id`). README lists exactly two unapplied migrations: `20260724140000` and `20260726020000`.
- **Impact:** Until applied, approving one old retention record wipes answers/emails of *all* submissions of that form (and redacts registrant identity of all registrations for event scope). Irreversible.
- **Root cause:** Fix migration authored but never applied to production.
- **Remediation:** Apply `20260726020000` following the recovery-snapshot procedure in the README. Add an ops alert if migration parity drifts again.

#### DB-002 — `membership_id_sequences` RLS enable missing from migration chain
- **ID:** DB-002 · **Severity:** High (replay/bootstrap) · Low (today's live DB) · **Confidence:** High (**Confirmed** — grep across all 104 migrations finds zero `enable row level security` for this table)
- **Category:** Database / Migration integrity
- **Affected files:** `supabase/migrations/20260426003000_membership_identity_foundation.sql:74–86,680`, `20260426004000_membership_identity_advisor_fixes.sql:25–30`
- **Evidence:** The chain creates a SELECT policy for admins but never enables RLS on the table. Live protection exists only because a production-only event trigger `rls_auto_enable()` (present solely in `schema.sql` and the disposable baseline helper `supabase/verification/baseline/20260608092959_restore_rls_auto_enable.sql`) turned it on. Grants are also never revoked, so default privileges would hand anon/authenticated full DML on a fresh replay.
- **Impact:** Any fresh environment bootstrap (or project where the trigger was dropped): anon/authenticated clients can corrupt the ID allocator (`allocate_membership_id()`) causing duplicate/conflicting `jnuits_id`s.
- **Root cause:** Reliance on an out-of-chain auto-enable trigger instead of declarative SQL.
- **Remediation:** Idempotent migration: `alter table public.membership_id_sequences enable row level security; revoke all on public.membership_id_sequences from anon, authenticated;`. Fold `rls_auto_enable()` into the chain or document it as an ops prerequisite.

### 3.3 Medium

#### SEC-002 — Supabase SSR session cookies lack `Secure`/`HttpOnly`; CSP allows inline scripts
- **ID:** SEC-002 · **Severity:** Medium · **Confidence:** High (Confirmed)
- **Category:** Session management
- **Affected files:** `src/utils/supabase/server.ts:9–28`, `src/utils/supabase/client.ts:5–10`, `src/lib/supabase/proxy.ts:155–180` (none pass `cookieOptions`); aggravator `src/lib/security/http-headers.ts:9–15`
- **Evidence:** `@supabase/ssr` `DEFAULT_COOKIE_OPTIONS = { path:"/", sameSite:"lax", httpOnly:false, maxAge:400d }`. HSTS only sent when `VERCEL_ENV === "production"`. CSP `script-src 'self' 'unsafe-inline'`.
- **Impact:** Any XSS can read refresh tokens (persistent takeover, up to 400-day cookies); tokens can transit plaintext HTTP where HSTS doesn't apply. `'unsafe-inline'` neutralizes most of CSP's XSS value and lowers the bar for the XSS needed to abuse JS-readable tokens. Only one HTML sink exists today (`event-markdown.tsx:53`, sanitized via sanitize-html), so exploitability is currently low but the chain is armed.
- **Root cause:** Library defaults accepted at all three client factories.
- **Remediation:** Pass `cookieOptions: { secure: process.env.NODE_ENV === "production" }` at all three call sites; send HSTS unconditionally on production hosts; migrate CSP to nonce/hash-based script-src (keep `unsafe-eval` dev-only).

#### API-001 — Raw database/error messages returned to clients
- **ID:** API-001 · **Severity:** Medium · **Confidence:** High (Confirmed — spot-checked)
- **Category:** Information disclosure
- **Affected files:** `src/app/api/profile/direct/route.ts:152–156` (verified: returns `updateError.message` raw), `src/app/api/profile/avatar/complete/route.ts:93–97`, `src/app/api/portal/workplace-requests/route.ts:212–217,273–281` (via `cancelWorkplaceRequest` throwing raw DB messages, `src/lib/admin/workplace.ts:405,435`), `src/app/api/profile/avatar/sign/route.ts:66–76` (Cloudinary config errors incl. env-var names), `src/lib/profile/avatar-access.ts:116–122,175–181`; action redirect variants in `portal/mentorship/actions.ts` (116–121,171–177,216–222,255–261), `(portal)/portal/profile/actions.ts` (101–106,153–155,200–202), `portal/tickets/actions.ts` (107–113,157–163)
- **Evidence:** The repo has an explicit policy ("Never expose raw Postgres/Supabase error codes") enforced by `apiError()`/`getSafeErrorMessage()` — these sites bypass it.
- **Impact:** Constraint/check-failure messages (table/column/constraint names, sometimes values) reflected in JSON responses or redirect params; aids further attacks; violates stated policy. All affected endpoints require auth, limiting blast radius.
- **Root cause:** Error paths written before/outside the sanitizer convention.
- **Remediation:** Route all error paths through `apiError()`; wrap DB errors in `workplace.ts` before throwing; use safe flash messages in action redirects.

#### HYG-001 — Plaintext invitation codes and privileged-account identity committed in `artifacts/reports/`
- **ID:** HYG-001 · **Severity:** Medium (High if repo becomes public) · **Confidence:** High (Confirmed — file tracked, commit identified)
- **Category:** Secrets/PII hygiene · Supply chain
- **Affected files:** `artifacts/reports/membership/super-admin-ensure-20260409T082828Z.json:10,14` and `artifacts/reports/migration-verification-2026-04-09.txt:27,29` (real personal Gmail identified as `super_admin` grant holder + auth user UUIDs + grant history); producers `scripts/onboard-members.mjs:272–292`, `scripts/reconcile-members.mjs:126–134` write plaintext `invitationCode` + member PII into `artifacts/reports/membership/*.json`; `.gitignore:22,38,56` ignores only `logs`, `facebook-jnuits/`, `backups/`
- **Evidence:** Tracked file confirmed present in git (commit `76b8385`). Codes valid ~14 days; DB stores them hashed precisely so plaintext shouldn't proliferate. `committed-credential-material.test.mjs` scans only `supabase/manual/*.sql`.
- **Impact:** Anyone with repo read access holds live member claim codes until expiry, plus a phishing-worthy privileged-account identifier. If the repo is ever made public this becomes credential disclosure.
- **Root cause:** Report-writing pipeline predates artifact-hygiene rules; gitignore gap.
- **Remediation:** Scrub/purge the named files (history rewrite if repo is/was public); add `/artifacts/reports/**` (or `/artifacts/`) to `.gitignore`; redact codes/emails from report schemas; widen the credential-material test.

#### OBS-001 — `logServerError` is a production no-op; caught failures invisible in Sentry
- **ID:** OBS-001 · **Severity:** Medium (observability/detection) · **Confidence:** High (**Confirmed**, personally verified)
- **Category:** Observability
- **Affected files:** `src/lib/errors/api-error.ts:66–72`
- **Evidence:**
  ```ts
  export function logServerError(context: string, error: unknown): void {
    if (process.env.NODE_ENV !== "production") { console.error(...); }
    // Sentry auto-captures unhandled Node errors.   ← wrong premise
  }
  ```
  Every caller wraps *caught* errors (webhook ledger writes, deliveries, persistence). Rate-limit backend failures log via separate `console.error` (also absent from Sentry).
- **Impact:** Silent degradation of security controls in production goes undetected (e.g., confirmation-ledger write failures, durable rate-limit outages).
- **Root cause:** Comment's assumption does not hold for handled exceptions.
- **Remediation:** `Sentry.captureException(error, { tags: { context } })` in the production branch.

#### DB-003 — `mentorship_relationships` participant UPDATE allows column mass assignment
- **ID:** DB-003 · **Severity:** Medium · **Confidence:** High
- **Category:** Database / RLS design
- **Affected files:** `supabase/migrations/20260424000000_multi_portal_phase3_features.sql:775–784` (rewrapped `20260710073007`)
- **Evidence:** `for update using (can_access_mentorship_relationship(id)) with check (same)` — any participant can modify any column: swap counterpart `user_id` while remaining a participant, reopen closed relationships, rewrite `created_by_user_id`.
- **Impact:** Redirect/spy on relationship threads; pollute history. WITH CHECK stays satisfied during the swap.
- **Root cause:** Row-level predicate used where column-level constraints were needed.
- **Remediation:** Constrain updates to `status`/`closed_at` transitions with OLD-row participant predicates, e.g. `using ((member_user_id=auth.uid() or alumni_user_id=auth.uid()) and status in ('requested','active'))`.

#### DB-004 — `projects` / `project_contributors` public SELECT includes archived rows
- **ID:** DB-004 · **Severity:** Medium · **Confidence:** High
- **Category:** Database / RLS design
- **Affected files:** `supabase/migrations/20260412000000_project_showcase.sql:64–66,79–81`
- **Evidence:** `create policy "projects unified select" on public.projects for select using (true)` — comment admits "archived included — hidden at app layer". Never revised by later hardening passes.
- **Impact:** Unpublished/archived content readable by anon forever; app-layer hiding is not a control. Compounded by PERF-010 (service-role client used for these reads).
- **Remediation:** `using (status <> 'archived')` for anon (or `is_public` flag); keep full read behind `cms.projects.manage`.

#### DB-005 — Public certificate verification is a PII enumeration surface with low-entropy IDs
- **ID:** DB-005 · **Severity:** Medium (accepted-risk design) · **Confidence:** High on exposure, Medium on exploitability
- **Category:** Database / Privacy
- **Affected files:** `supabase/migrations/20260408001000_identity_certificates_rls.sql` (+ shaping migrations `20260705020732`, `20260706025103`); app layer `src/app/api/certificates/*`
- **Evidence:** Public safe-read exposes `full_name`, free-form `details`, `asset_url`; `certificate_id` is admin-entered free text ≤80 chars with no entropy/format constraint. Mitigations present: 25-ID batch cap, IP rate limits (~43k guesses/day/IP), uniform 404s, durable counters, locked-down view.
- **Impact:** Holder list harvestable if IDs are guessable; rate-limited but not stopped.
- **Remediation:** Enforce high-entropy certificate IDs (≥12 random chars) at import/upsert; exact-match lookup returning single rows; drop free-text `details` from public projection if it embeds personal data.

#### PERF-001 — Middleware performs Supabase auth round-trips on every request, including anonymous public traffic
- **ID:** PERF-001 · **Severity:** High (performance) · **Confidence:** High (**Confirmed**, personally verified)
- **Category:** Performance / Architecture
- **Affected files:** `src/lib/supabase/proxy.ts:183–193` (matcher in `src/proxy.ts`)
- **Evidence:** `await supabase.auth.getUser()` **and** `await supabase.auth.getClaims()` run unconditionally on every matched request (+ possible `current_rbac_claims_snapshot` RPC when claims lack roles); matcher excludes only static assets.
- **Impact:** 1–3 network round trips added to TTFB site-wide (~50–300 ms typical), including anonymous visits to ISR-able public pages; negates CDN benefits.
- **Remediation:** Skip session work when no `sb-*` cookie exists; short-circuit known-public prefixes; call `getUser()` only when `getClaims()` indicates a session.

#### PERF-002 — `revalidate = 60` defeated by cookie-bound client on home & about (ISR dead)
- **ID:** PERF-002 · **Severity:** High (performance) · **Confidence:** High (**Confirmed**, personally verified)
- **Category:** Performance / Caching correctness
- **Affected files:** `src/app/(public)/page.tsx:31,33,151–153,311`; `src/app/(public)/about/page.tsx:15,295`; inert twin `src/app/(public)/notices/page.tsx:18,145`
- **Evidence:** Home declares `revalidate = 60` but `getHomepageAdvisorQuote` calls `createClient()` → `cookies()` → dynamic rendering; same for about's advisor messages. Both datasets are fully public (`is_public = true` filters) — no authorization reason to touch cookies. Sibling queries in the same files already use cookie-free `createPublicClient()`.
- **Impact:** The two highest-traffic public pages render per request with 3–5 Supabase queries each, stacked on PERF-001.
- **Remediation:** Swap those queries to `createPublicClient()`; drop or fix the inert notices directive.

#### PERF-003 — Entire committee roster serialized into one client component's props
- **ID:** PERF-003 · **Severity:** Medium (performance) · **Confidence:** High
- **Category:** Performance / Payload size
- **Affected files:** `src/app/(public)/committee/page.tsx:30–54`; `src/lib/committee/public.ts:299–305`; `CommitteePageClient.tsx:31`
- **Evidence:** Up to 24 terms × 512 nested assignment rows + 32 advisors with full speech text passed wholesale to a client component whose only state is one boolean; route has no ISR.
- **Impact:** Hundreds of KB duplicated in RSC flight payload per visit; slow LCP on mobile.
- **Remediation:** Server-render hero/advisors/default term; lazy-fetch other terms; strip long text from non-visible terms.

#### PERF-004 — react-markdown pipeline shipped to browsers on all article pages
- **ID:** PERF-004 · **Severity:** Medium (performance) · **Confidence:** High
- **Category:** Performance / Bundle
- **Affected files:** `src/components/notices/notice-markdown.tsx:1–4`, `blog-markdown.tsx:1–4`, `event-markdown.tsx:4–5`
- **Evidence:** All three renderers are `"use client"` though content is static strings from server pages; nothing interactive.
- **Impact:** ~40–100 KB min/gz per notice/blog/event detail pageview.
- **Remediation:** Render in RSC (react-markdown works server-side), or pre-render to sanitized HTML server-side (sanitize-html already a dependency).

#### PERF-005 — Members directory facet scans are unbounded; 6+ queries per render
- **ID:** PERF-005 · **Severity:** Medium (performance) · **Confidence:** High
- **Category:** Performance / Scalability
- **Affected files:** `src/lib/members/directory.ts:470–495,519–534`
- **Evidence:** Department/type facets select over *every* matching member row with no limit, counted in JS; combined with head-counts and viewer-context = 6+ round trips per page view.
- **Impact:** O(all-members) transfers as alumni base grows ("2000+" advertised).
- **Remediation:** Group-count RPC (pattern exists: `get_event_registration_counts`, `src/lib/content/events.ts:583`) or `{count:'exact', head:true}` per facet.

### 3.4 Low

| ID | Title | Files (evidence) | Impact / Remediation |
|----|-------|------------------|----------------------|
| SEC-003 | Stale JWT role claims trusted; `jnuits_role_version` never compared | `src/lib/supabase/proxy.ts:186–195`, `src/lib/auth/session.ts:142,189–219` | Revoked role remains valid until token refresh (~1h) on null-permission/read surfaces; compensated by per-operation `has_permission` DB rechecks. Compare claim version against `current_rbac_claims_snapshot()` in guards |
| SEC-004 | Password change reauthentication optional | `(auth)/actions.ts:613–662`, `change-password-form.tsx:109–117` | Hijacked AAL1 session can set new password. Require fresh reauth nonce inside the action; clear step-up cookies (SEC-005) |
| SEC-005 | Step-up & directory-verification cookies survive logout/password change | `logout-button.tsx:25–32`, `step-up.ts:6–13`, `directory-verification.ts:16–30` | Same-user continuity on shared machines. Delete `jnuits-step-up`, `member_directory_verified*` on sign-out and password update |
| SEC-006 | Rate-limit IP key trusts spoofable headers | `rate-limit.ts:151–158` (**verified**) | `x-real-ip ?? cf-connecting-ip ?? x-forwarded-for[0]` — off-Vercel, attackers rotate fake IPs defeating IP-keyed limits. Prefer platform-authoritative header; make trusted header deployment-configurable |
| SEC-007 | Invite-claim resets password of existing unlinked auth user sharing email | `(auth)/actions.ts:197–260,759–774` | Design-inherent (code arrives by email); mitigations strong (60-bit CSPRNG codes, HMAC storage, 5/15min/IP+email limits, Turnstile). Prefer sending password-set link instead of inline set |
| SEC-008 | HMAC key reuse: `SUPABASE_SECRET_KEY` doubles as app MAC key | `step-up.ts:10`, `invitation-code.ts:14–18`, `directory-verification.ts:10–14` | Key-separation violation; rotation invalidates all hashes at once. Dedicated `STEP_UP_SECRET` env var |
| SEC-009 | `supabase.auth.resend` error-vs-success distinction may leak account existence | `(auth)/actions.ts:558–577` | Depends on GoTrue config. Uniform redirect regardless of error type |
| SEC-010 | `/admin/audit/export` converts auth redirects into HTTP 500 | `admin/audit/export/route.ts:11–38`, `api-error.ts:47–60` | Fails closed; noise/logs. Check permission outside try/catch or special-case `isRedirectError` |
| API-002 | `GET /api/members` bare handler, no guard/rate limit | `api/members/route.ts:6` | Scraping/cost concern (data public-safe, excludes email/phone/address). Wrap with `withApiGuard` |
| API-003 | Notices attachment proxies upstream `Content-Type: inline` | `(public)/notices/[slug]/attachment/route.ts:38–58` | Admin-planted HTML raw asset would render on origin. Force attachment disposition or allowlist PDF/images |
| API-004 | Profile change-requests: no rate limit, no pending-duplicate guard | `api/profile/change-requests/route.ts:254` | Moderation-queue flooding/data bloat (auth required). Add `RATE_LIMITS.profileDirect` + dedupe like workplace route |
| INT-001 | Avatar upload signature lacks `allowed_formats`/size cap | `api/profile/avatar/sign/route.ts:43–50` | Arbitrary formats/sizes incl. SVG at fixed public_id (RL 10/5min). Sign format+size constraints like forms flow does |
| INT-002 | `media-assets/register` accepts any URL host | `api/admin/media-assets/register/route.ts:22` | Admin-trust only; `isCloudinaryAssetUrl` helper unused. Pin to `https://res.cloudinary.com/**` |
| INT-003 | Contact submit puts user text into outbound subject line | `api/contact/submit/route.ts:206` | Zod-capped 120 chars; JSON API prevents CRLF; cosmetic spam risk. Strip control chars or move to body |
| INT-004 | Export search builds PostgREST `.or()` with backslash escaping | `registrations/export/route.ts:62–64`, `operations-filters.ts:31–33` | Parser may treat escapes as literals; admin-only blast radius. Use quoted-value syntax |
| DB-006 | Registration codes ~32-bit, revealed verbatim on duplicate submission | `20260411000000_event_registration.sql:13–14` | Latent (all RPCs service-role-only). Lengthen ≥128 bits; require mailbox proof to re-reveal |
| DB-007 | `admin_invitations` invitee UPDATE policy lets target flip own row status | `20260630190842_admin_account_lifecycle.sql:110–129`, recreated `20260710073007_phase2_rls_initplan_uid_wrap.sql:18–32` | Audit/state forgery, no privilege gain. Split policies: invitee read-only; mutations manager-only |
| DB-008 | Residual PUBLIC EXECUTE on RBAC helper functions | creators `20260423001000_rbac_claim_hook_and_helpers.sql`; partial revokes `20260608093000`, `20260628034000` | `current_admin_role()`, `current_portal_role()`, `is_aal2()` callable by anon via REST; SECURITY INVOKER so negligible. `revoke execute … from public` |
| DB-009 | `operator_reports` INSERT gated on a *read* permission | `20260608093000_admin_permission_policy_hardening.sql:345–350` | Read-only holders can fabricate report rows. Drop insert policy |
| DB-010 | Constraint/integrity gaps | members.student_id no unique partial (race dupes) · event_registrations.event_id ON DELETE SET NULL orphans PII · content_posts delete cascades registrations away · events.registration_form_version_id FK unindexed · alumni_onboarding_cases.jnuits_id no CHECK · admin_invitations.email no unique active-invite · mentorship closed doesn't force closed_at · form_submissions cancelled_at vs registration_status duality | Add partial unique indexes/CHECKs/triggers per table |
| PERF-006 | Blog list query selects full `body` markdown for cards | `public-content.ts:212–215,1207–1215` | Up to 24 full articles transferred per list render. Create `blogListSelect` without body (events did it right) |
| PERF-007 | Lightbox eagerly bundled + CSS global in root layout | `layout.tsx:8–9`, `gallery-load-more.tsx:4–5,245–262` | ~20–40 KB paid site-wide. `next/dynamic` on first click; scope CSS |
| PERF-008 | Global `images.unoptimized:true` — srcset inert, single variant | `next.config.ts:28–38`, `HomepageSlider.tsx:110–112` | Phones download w_1800. Manual srcSet via `getImageProps` + Cloudinary widths; bound slider variant |
| PERF-009 | Admin CSV/XLSX exports buffer whole dataset (10k cap then throw) | `registrations/export/route.ts:51–115` | Memory/latency; huge events can't export. Stream via ReadableStream, incremental checksum |
| PERF-010 | Projects module: unbounded public query + service-role client on public paths | `projects.ts:84–114` (client usage :88,:119,:147) | Growth-sensitive; architecture smell bypassing future RLS. Limit/paginate, `cache()`, `createPublicClient()` |
| PERF-011 | Certificates landing force-dynamic without query | `(public)/certificates/page.tsx:11` | Static shell re-rendered per request. Split result into Suspense child |
| PERF-012 | Near-zero error/loading boundaries (no `error.tsx`; only 2 `loading.tsx`) | tree-wide | Framework-default failure UX. Add per-group error/loading boundaries |
| CI-001 | Gitleaks skipped for fork PRs; Required gate accepts skipped | `quality-gate.yml:423,416–418` | Fork credential-shaped content scanned only post-merge. Scan PR diff for forks too |
| CI-002 | Self-hosted runner retirement unverifiable | `docs/operations/self-hosted-runners.md:45–57` | If still registered, persistent-state risk. Confirm deregistration; close checklist |
| CI-003 | Legacy MySQL importer disables TLS verification | `scripts/lib/legacy-content.mjs:116–129` | MITM on retired Strapi host during recovery drills. Pin CA or drop flag |
| CI-004 | `mysql2` ships as production dependency | `package.json:63` | Recovery-tooling only. Move to devDependencies/workspace |
| HYG-002 | No pre-commit hooks; credential test narrow | no husky/lefthook/core.hooksPath; `committed-credential-material.test.mjs` covers only `supabase/manual/*.sql` | Secrets can be pushed before CI catches. Optional local `gitleaks protect -staged`; widen test scope |
| HYG-003 | Docs disclose staging ref, personal Gmail, internal paths | `plan/GALLERY_TRELLO_TRACKER.md:197`, `plan/IMPLEMENTATION_TRACKER.md:25–26`, `plan/New_Plan.md:22` | Recon value. Genericize ref; role alias emails |

### 3.5 Info / Notes

- **INFO-001** `/monitoring` Sentry tunnel is an open event proxy (quota/noise abuse; DSN public anyway). Consider inbound-filter rules.
- **INFO-002** `debug/sentry` gating correct on Vercel/prod; self-hosted misconfiguration edge only.
- **INFO-003** Duplicated `.select()` chains silently drop `department_code` (`profile/direct/route.ts:59–62`, `change-requests/route.ts:88–93`) — latent correctness bug.
- **INFO-004** `diff-check.yml:26–31` interpolates SHAs into shell (GitHub-controlled hex; anti-pattern only). Unquoted `rm -rf -- $path` in docker-preflight composite (fixed inputs today).
- **INFO-005** `scripts/tmp-fest-live-probe.mjs` imports transitive `playwright`; stray tmp script tracked.
- **INFO-006** Historical fixed-in-chain issues (verify live DB): event_registrations was anon-writable/readable (fixed `20260612090000`; the June-8 schema.sql snapshot still shows the old policy because it predates the fix); rbac moderator self-escalation; profiles mass assignment; policies defaulted TO PUBLIC; bootstrap super_admin seeded by hardcoded (public) Gmail — ensure MFA covers it.
- **INFO-007** MCP-connected Supabase credentials point at a **different project's schema** — live-vs-migration drift could not be verified remotely during this audit. Run the repo's own parity tooling (`migration:check`, cleanup audits) against the real refs. Not a repo vulnerability.
- **INFO-008** E2E failure artifacts contain test-account page content (dedicated fixtures; acceptable).
- **INFO-009** Advisor `email` is selected into the public committee directory payload (`committee/public.ts:66,135,360`) — confirm intended.

### 3.6 Verified-strong controls (do not regress)

DB-backed RBAC with service-role-only finalizers; per-action/per-route permission checks across all 17 admin action files and 23 admin API routes (CI-checked access map); open-redirect hygiene (`resolveSafeNextPath`/`resolveScopedNextPath`, host-pinned confirm); `checkAdminMFA` fails closed; atomic invite claiming (`FOR UPDATE`, hashed codes); race-safe event capacity (row locks + partial unique index); append-only audit tables; pinned `search_path` on all SECURITY DEFINER functions; `security_invoker` public views; Svix timing-safe webhook verification with symmetric replay window; triple-gated confirmation resends; exemplary form-upload proof chain; fully fail-closed CAPTCHA (no production mock path); comprehensive Sentry scrubbing; SHA-pinned Actions with digest-verified tool installers; placeholder-only fork-reachable env; `.env.example` contract mirroring `validate-env.mjs`; name-based `NEXT_PUBLIC_*` secret guard; members directory excludes email/phone/address with triple-gated workplace fields; single sanitized HTML sink repo-wide.

---

## 4. Performance Summary

Site-wide latency is dominated by two items with small fixes:

1. **PERF-001** — middleware auth round-trips on 100% of requests. Gate on `sb-*` cookie presence + skip public prefixes.
2. **PERF-002** — home/about ISR defeated by accidental `cookies()` access. Swap to `createPublicClient()`.

Payload: committee roster flight payload (PERF-003), client-side markdown (PERF-004), blog-list body column (PERF-006), global lightbox CSS (PERF-007). Scale risks: members facets (PERF-005), projects unbounded (PERF-010). Biggest client bundles: `committee-workspace-client` 158.7 KB (admin), `membership-db-client` 79 KB (admin), `public-form-screen` 30.6 KB (public).

Timer/listener hygiene audited clean (36 setTimeout + 25 addEventListener sites, balanced cleanup). Good patterns to preserve: React `cache()` dedupe across metadata+render, parallel loading (home/about/admin 9-way dashboard), batched count RPCs, keyset pagination with IntersectionObserver cleanup, SQL-side pagination, thorough `revalidatePath` hygiene including previous-slug invalidation + sitemap, list/detail column separation (events).

---

## 5. Dependency Review

- `npm audit`: **0 vulnerabilities** (`--omit=dev` and full).
- Lockfile v3, all resolutions from `registry.npmjs.org`; exactly 4 install-script packages, all mainstream (`@sentry/cli`, `fsevents`×2, `unrs-resolver`).
- `lucide-react@^1.8.0` verified legitimate 2026 release (registry resolution + integrity hash).
- Overrides: single deliberate pin `postcss: 8.5.25`.
- Dependabot: github-actions weekly (policy-enforced by `workflow-action-policy.mjs`); **npm updates intentionally excluded** — manual `check-dependency-audit` gate with one time-boxed GHSA exception. Coherent but relies entirely on human process (watch item).
- `mysql2` in production deps unnecessary (CI-004).

## 6. CI/CD Assessment

Mature posture: least-privilege permissions everywhere, no `pull_request_target`, fork PRs see placeholder env only, prod jobs dispatch-gated behind protected GitHub environments, third-party actions 40-hex SHA-pinned with automated policy tests, digest-pinned binary installers rebuilt per run. Findings CI-001/CI-002/CI-003 are hardening leftovers, not active exposures.

Git history (559 commits) swept for credential patterns (`sk_live_`, AKIA, PEM blocks, legacy Supabase JWT headers, `re_` keys, real-shaped `sb_secret_`/`whsec_`): **clean** — every hit traced to placeholders/validation code via diff inspection. The only history concern is HYG-001 (PII artifacts, not credentials).

## 7. Test Gaps

1. **One vitest suite fails to load:** `scripts/import-ai-it-fest-2026-events.test.mjs` throws `SyntaxError: Invalid or unexpected token` under the vitest node project while passing plain `node --check` (imports also clean, no BOMs). All other suites green: 162 files / 1,087 tests pass. Investigate transform/config quirk or rewrite suite.
2. **No error/loading boundary tests or coverage** beyond members routes (PERF-012) — failure UX is framework-default almost everywhere.
3. **Access-map CI check covers pages, not actions:** `scripts/check-admin-access-map.cjs` validates page routing but nothing asserts that actions invoked from AAL2-gated pages pass `requireAal2` — precisely the class of gap as SEC-001. Add a lint-style rule/test.
4. **Credential-material test scope too narrow** (`supabase/manual/*.sql` only) — does not cover `artifacts/reports/**` where actual PII landed (HYG-001).
5. **E2E matrix runs only on dispatch/weekly cron**, not PR gates — regressions in critical flows surface late.
6. **Live-DB parity has no automated gate** in CI; drift like DB-001 (two unapplied migrations) was caught manually. Add migration-parity check to production-readiness workflow.
7. **Dependabot npm exclusion** means dependency freshness depends on the manual audit script cadence.

---

## 8. Remediation Roadmap

### Phase 0 — Immediate (this week)
1. Apply pending migrations `20260724140000` + `20260726020000` to production (DB-001), following README recovery-snapshot procedure.
2. Add `requireAal2: true` to `saveAdminSecuritySettings` (SEC-001).
3. Purge/scrub `artifacts/reports/membership/super-admin-ensure-*` + `migration-verification-2026-04-09.txt`; gitignore `/artifacts/reports/**` (HYG-001).
4. Add idempotent RLS-enable + grant-revoke migration for `membership_id_sequences` (DB-002).

### Phase 1 — High value, low effort (next sprint)
5. `logServerError` → captureException in prod (OBS-001).
6. `cookieOptions.secure` at all three Supabase client factories + unconditional prod HSTS (SEC-002 part 1).
7. Route the six raw `error.message` sites through `apiError()` (API-001).
8. PERF quick wins: middleware cookie-presence gating (PERF-001); `createPublicClient()` swap on home/about (PERF-002).
9. Rate-limit `POST /api/profile/change-requests` and `GET /api/members` (API-004, API-002).
10. Sign `allowed_formats`/`max_bytes` on avatar uploads (INT-001).

### Phase 2 — Structural (next month)
11. CSP nonce-based script-src (SEC-002 part 2).
12. RLS policy fixes: mentorship update constraints (DB-003), projects archived filter (DB-004), admin_invitations split policies (DB-007), PUBLIC EXECUTE revokes (DB-008), operator_reports insert policy (DB-009), constraint gaps (DB-010).
13. Payload/bundle: committee server-rendering (PERF-003), markdown to RSC (PERF-004), blog list select trim (PERF-006), lightbox lazy-load (PERF-007), facet group-counts (PERF-005).
14. Error/loading boundaries per route group (PERF-012).
15. Certificate-ID entropy enforcement (DB-005); notices attachment disposition (API-003).

### Phase 3 — Hardening & hygiene (quarter)
16. Enforce `jnuits_role_version` comparison (SEC-003); require reauth for password change + purge auxiliary cookies on logout (SEC-004/005); dedicated MAC secret (SEC-008).
17. IP-header trust configuration for non-Vercel deploys (SEC-006); gitleaks on fork diffs (CI-001); confirm runner retirement (CI-002); fix MySQL TLS + move mysql2 to devDeps (CI-003/004); pre-commit gitleaks (HYG-002); docs scrub (HYG-003).
18. Test-gap items 1, 3, 6, 7 above; regenerate `schema.sql` baseline (grants in snapshot are superseded by later hardening migrations — replaying it alone would regress).

### Priority Table

| # | ID | Finding | Severity | Effort | Phase |
|---|----|---------|----------|--------|-------|
| 1 | DB-001 | Apply retention boundary migrations to prod | High | Small (ops) | 0 |
| 2 | SEC-001 | `requireAal2` on MFA kill-switch action | High | Trivial | 0 |
| 3 | HYG-001 | Scrub PII/code artifacts + gitignore reports | Medium | Small | 0 |
| 4 | DB-002 | membership_id_sequences RLS migration | High (replay) | Trivial | 0 |
| 5 | OBS-001 | logServerError → Sentry in prod | Medium | Trivial | 1 |
| 6 | SEC-002 | Secure cookies + unconditional HSTS (+ CSP later) | Medium | Small | 1–2 |
| 7 | API-001 | apiError() everywhere | Medium | Small | 1 |
| 8 | PERF-001 | Middleware auth gating | Perf-High | Small | 1 |
| 9 | PERF-002 | ISR fix home/about | Perf-High | Trivial | 1 |
| 10 | API-004/API-002 | Missing rate limits | Low | Trivial | 1 |
| 11 | INT-001 | Avatar upload constraints | Low-Med | Trivial | 1 |
| 12 | DB-003…DB-010 | RLS/constraint policy fixes | Med/Low | Medium | 2 |
| 13 | PERF-003…007 | Payload cuts | Perf-Med | Medium | 2 |
| 14 | DB-005 | Certificate-ID entropy | Medium | Small | 2 |
| 15 | PERF-012 | Error/loading boundaries | Low | Small | 2 |
| 16 | SEC-003…009 | Auth hardening set | Low | Medium | 3 |
| 17 | CI-001…004, HYG-002/003 | CI/script hygiene | Low | Small | 3 |
| 18 | Test gaps 1–7 | Suite fix, action-level AAL2 rule, parity gate | Hygiene | Medium | 3 |

---

## Appendix A — Verification Log

| Check | Result |
|---|---|
| `npm run typecheck` (tsc --noEmit) | PASS clean |
| `npm run lint` (eslint .) | PASS clean |
| `npm test` (vitest) | 162 files, 1,087 tests pass; 1 suite fails to load (see §7.1) |
| `npm audit --omit=dev` / full | 0 vulnerabilities / 0 vulnerabilities |
| Git history secret sweep (git log -S, 559 commits) | Clean — all hits placeholders/validation code |
| SEC-001, OBS-001, PERF-001/002, API-001 sample, SEC-006, HYG-001 file tracking, DB-002 grep | Personally re-verified during this audit |
| Live Supabase drift check via MCP | Blocked — connected credentials point at an unrelated project schema (INFO-007) |

## Appendix B — Scope Notes

- No storage bucket policies exist in migrations; no edge functions directory; extensions limited to pgcrypto/citext/pg_trgm.
- `supabase/schema.sql` is a ~2026-06-08 snapshot; several of its grants/policies are superseded by later migrations — regenerate before using it for replay.
- Repository visibility (public/private) could not be determined from the clone; HYG-001 severity assumes private-but-shared today.
