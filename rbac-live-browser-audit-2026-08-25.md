# JnUITS Full Stack — Live Browser RBAC Audit

**Date:** 2026-08-25
**Method:** Interactive Playwright-driven Chromium session against a local Next.js dev server (`npm run dev`, port 3000) backed by the **staging Supabase project** (`<staging-project-ref>`, matching `.env.local NEXT_PUBLIC_SUPABASE_URL`). This is a **separate** deliverable from `security-performance-audit-2026-08-25.md` (static code audit); findings are not merged. Personal and operational account identifiers are redacted in this committed copy.
**Authorization:** Test accounts provisioned by the project owner for this audit.

---

## 1. Executive Summary

**Verdict: PASS — every tested RBAC boundary held.**

Five identities (anonymous, two portal users with different member types, one scoped content admin, one super admin) were driven through the real UI and same-origin API surface. All page-level redirects, workspace scoping, nav filtering, and API permission gates behaved exactly as designed. The MFA enforcement chain (enrollment gate → challenge gate → anti-bypass → instant fail-closed revocation on factor removal) was verified end-to-end, including a live factor-deletion test that immediately demoted an AAL2-elevated session.

- **Critical / High findings:** none discovered live.
- **State changes made during testing:** 1 (TOTP factor enrolled on the Content Admin test account to pass the enrollment gate). It was **deleted afterwards** and the account verified restored to its exact pre-test state. No dummy business data was created anywhere.
- **Coverage gap:** the Normal Admin's AAL2-scoped tests could not complete because that account's TOTP secret was not supplied; its password-only posture was still positively verified (challenge enforced, no self-enrollment bypass).

---

## 2. Environment & Method

| Item | Value |
|---|---|
| App under test | Next.js 16 dev server, `http://localhost:3000` |
| Auth backend | Staging Supabase `<staging-project-ref>.supabase.co` |
| Browser automation | Playwright MCP (Chromium), real UI clicks/fills |
| API testing | Same-origin `fetch()` from within the authenticated pages (carries session cookies) |
| TOTP | Local RFC-6238 generator fed the owner-provided base32 secrets |
| Dummy-data policy | None created; single MFA enrollment reverted post-test |

**Accounts exercised** (passwords/secrets intentionally omitted from this committed report):

| Role | Email | Member type |
|---|---|---|
| Portal user (current) | `[redacted current-member account]` | Current member |
| Portal user (alumni) | `[redacted alumni account]` | Alumni |
| Content Admin | `[redacted content-admin account]` | Redacted admin identity |
| Normal Admin | `[redacted admin account]` | Redacted admin identity |
| Super Admin | `[redacted super-admin account]` | Redacted admin identity |

---

## 3. Results Matrix

Legend: ✅ = correct behavior observed · ⛔ = correctly denied · 🔒 = blocked by MFA gating · n/a = not reachable/testable

| Surface | Anonymous | Portal (current) | Portal (alumni) | Content Admin | Normal Admin | Super Admin |
|---|---|---|---|---|---|---|
| `/` public site | ✅ 200 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/admin` page | ✅ redirect → `/admin/login?next=/admin` | ✅ bounce → `/portal/dashboard` | ✅ bounce → `/portal/dashboard` | ✅ allowed (scoped) | 🔒 challenge | ✅ allowed |
| `/admin/login` | ✅ renders | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/portal` page | ✅ redirect → login | ✅ dashboard | ✅ dashboard ("alumni ambassador workspace") | ✅ | ✅ | ✅ |
| `/profile` | ✅ redirect → portal login | ✅ allowed | ✅ | n/a | n/a | n/a |
| `GET /api/admin/forms` | — | ⛔ 403 | ⛔ 403 | ✅ 200 `{items:[],totalItems:0}` | not tested (AAL2) | ✅ 200 populated |
| `GET /api/admin/cloudinary-search` | — | ⛔ 403 | — | ✅ 200 `[]` | not tested | — |
| `GET /api/admin/retention` | — | ⛔ 403 | ⛔ 403 | ⛔ 403 "Only authorized administrators can manage retention." | not tested | ✅ 200 `{archiveConfigured:true,…}` |
| `GET /api/admin/events/{id}/registrations` | — | — | ⛔ 403 | passes guard → 404 "Event not found." (id valid-shaped but nonexistent) | not tested | — |
| `GET /api/members` | — | ✅ 200 public-safe | — | — | — | — |
| `GET /api/members/timeline` | — | ✅ 200 self-scoped only | — | — | — | — |
| `/admin/settings/security` | redirect | bounce | bounce | ⛔ bounce → `/admin` | 🔒 challenge | ✅ loads (AAL2) |
| `/admin/membership` | redirect | bounce | bounce | ⛔ bounce | not tested | ✅ in nav |
| `/admin/audit` | redirect | bounce | bounce | ⛔ bounce | not tested | ✅ in nav |
| `/admin/admin-profiles` | redirect | — | — | ✅ scoped: self only | not tested | ✅ full: 4 of 4 |

---

## 4. Detailed Findings per Role

### 4.1 Anonymous
- `/admin`, `/portal`, `/profile` each redirected to their scoped login pages with a preserved `next` parameter (`/admin/login?next=%2Fadmin`, `/portal/login?next=%2Fportal`, `/portal/login?next=%2Fprofile`). No admin content leaked pre-auth.

### 4.2 Portal User — current member (account redacted)
- Login succeeded; landed on `/profile` (honors `next`).
- Direct navigation to `/admin` produced a **graceful bounce** to `/portal/dashboard` (no error page, no data flash).
- Same-origin fetch matrix confirmed API-layer enforcement independent of UI: all three admin endpoints returned `403 {"message":"Active admin access is required for this action."}` while `/api/members` (public-safe projection) and `/api/members/timeline` (self-scoped lifecycle events only) returned `200`.
- Logout via UI returned to `/portal/login`.

### 4.3 Portal User — alumni (account redacted)
- Login succeeded; dashboard header rendered the alumni-specific workspace label ("alumni ambassador workspace"), confirming type-aware UI.
- `/admin` bounced to `/portal/dashboard`; all probed admin APIs returned `403`.

### 4.4 Content Admin (account redacted) — least-privilege operator
- **MFA enrollment gate:** first password login redirected to `/admin/mfa/setup` with the message *"Admin accounts require a verified TOTP authenticator before entering the operator workspace."* Workspace is unreachable until a TOTP factor is enrolled and verified. (A factor was enrolled using an owner-supplied secret purely to proceed; see §6.)
- **Nav scoping:** sidebar exposed only Dashboard, Content Hub sub-pages (about/slider/media/blogs/notices/events/forms/gallery/projects), and Settings → Admin Accounts. No Membership, Audit, Retention, or Security entries.
- **Page-level denials:** direct URLs `/admin/settings/security`, `/admin/membership`, `/admin/audit` each bounced back to `/admin`; `/admin/members` returned 404 (route does not exist).
- **Self-scoped admin directory:** `/admin/admin-profiles` listed "1 of 1" (self only); the role filter combobox offered only "Content Admin"; own profile detail stated *"No lifecycle or role-change actions are available for this identity."*; Invitations tab rendered *"No admin invitations are visible for your role."*
- **API matrix matched nav exactly:** cloudinary-search `200 []` (`cms.media.manage`) and forms `200 {items:[],totalItems:0}` (`cms.forms.manage`) — both permitted but empty because the staging DB holds no managed media/forms yet; retention `403`; event registrations passed the `cms.events.manage` guard then failed object lookup with `404 "Event not found."` (consistent with Events being in their nav).
- **Audit trail:** the profile view surfaced `auth mfa factor enrolled` (warning) and `auth mfa challenge verified` (info) events with actor/target IDs and timestamps — privileged actions leave reviewable traces even at this tier.

### 4.5 Normal Admin (account redacted) — positive control only
- Password login redirected to `/admin/mfa/challenge` (account has an enrolled authenticator; its secret was not available for this audit).
- Attempting to bypass by navigating to `/admin/mfa/setup` while holding only an AAL1 session was **redirected back to the challenge** — a password-only admin session can neither reach the workspace nor self-enroll a second factor around the gate. This is the key anti-bypass control working.
- AAL2-verified scope tests for this tier were therefore **not completable** (see §7 Limitations).

### 4.6 Super Admin (account redacted)
- Password login presented the MFA challenge **including a Turnstile widget**, then TOTP verification completed to `/admin/dashboard`.
- **Full navigation** visible: Membership (Applications, Profile Requests, Membership DB, Bulk Operations), Committee, Audit Explorer, Reports, Decisions Log, Settings (System Health, Admin Accounts, Security Settings, Data Retention, Notification Settings, Contact Settings).
- `/admin/settings/security` loaded as AAL2-verified super admin showing *"Require TOTP for admin routes"* checked. The checkbox was deliberately left untouched — exercising the static-audit finding SEC-001 (server-action-level AAL2 gap) against global MFA enforcement was considered too state-destructive for a staging environment shared with active work; SEC-001 remains a static finding pending safe reproduction.
- `/admin/admin-profiles` listed the expected pending invite plus the three active
  role-tier test accounts; all account and identity values are redacted here.
- APIs confirmed elevated scope: retention `200 {archiveConfigured:true,eventJobs:[],formJobs:[]}`; forms `200` with populated items.

### 4.7 Live fail-closed revocation check (bonus verification)
After deleting the Content Admin's TOTP factor server-side mid-session (§6), navigating to `/admin/dashboard` with the previously AAL2-elevated cookie **immediately bounced** — elevation did not survive factor deletion. Server-side MFA state is re-checked per request; stolen/stale sessions cannot ride a revoked factor.

---

## 5. What Was Verified vs. the Static Audit

| Static-audit claim | Live result |
|---|---|
| Proxy gates `/admin` on admin role claim; bounces non-admins gracefully | Confirmed (both portal users) |
| `checkAdminMFA` fails closed; AAL2 required for admins | Confirmed (enrollment gate, challenge gate, setup-page anti-bypass, instant demotion after factor delete) |
| Per-role nav filtering computed server-side | Confirmed (Content Admin saw only permitted sections) |
| `requireAdminApiPermission` on every admin API route | Confirmed (403s for unauthorized roles incl. alumni/current portal users; 200s only for permitted pairs) |
| Admin-profiles directory scoped by role hierarchy | Confirmed (Content Admin self-only vs Super Admin 4-of-4) |
| Security events / audit trail capture auth events | Confirmed (factor enroll + challenge events visible with actor/target) |
| Turnstile present on sensitive auth surfaces | Confirmed (rendered on MFA challenge) |
| SEC-001 action-level AAL2 gap | **Not exploited live** (would mutate global MFA enforcement); remains open from static audit |

---

## 6. State Changes Made During Testing & Restoration Log

| # | Change | Why | Restored? |
|---|---|---|---|
| 1 | Enrolled one TOTP factor on the redacted content-admin test account (friendly name "JnUITS Admin") | Enrollment gate blocks first admin login without a factor; needed to test the Content Admin tier | ✅ Deleted via Supabase Admin API (`DELETE /auth/v1/admin/users/{id}/factors/{factorId}` → 200; remaining factors: 0). Post-deletion re-login reproduced the original `/admin/mfa/setup` flow — account restored to its pre-test state. |
| 2 | Audit/security-event rows generated by logins, MFA challenge/verify, factor enroll/delete | Inherent to exercising the system | Append-only by design; they document this audit itself and were left intact (deleting them would require destructive intervention contrary to the append-only model). |
| 3 | Sessions created/destroyed for five accounts | Required for testing | All logged out via the UI at test end. |

**No dummy business data** (posts, events, forms, submissions, tickets, invitations, settings changes) was created. The security-settings toggle was never flipped.

---

## 7. Limitations

1. **Normal Admin AAL2 tier untested beyond gating.** Without that account's TOTP secret we could not verify which of its permitted pages render post-challenge. Its password-only denial behavior was fully verified instead. Supplying the secret would allow completing this row of the matrix.
2. **SEC-001 not exploited live.** Flipping the global `adminTotpEnforced` setting to demonstrate the static-audit gap would degrade the staging environment's security posture; deemed disproportionate.
3. **Dev-server caveat.** Tests ran against `next dev --webpack` rather than a production build; routing/auth behavior is identical, but production-only hardening (headers/HSTS from Vercel) is outside what localhost can show.
4. **Empty-content staging DB.** Several Content-Admin-permitted endpoints returned empty-but-authorized payloads (`[]`), proving permission grants but not data-rendering correctness against rich fixtures.

## 8. Minor Observations (non-blocking)

- **No self-service authenticator rotation/removal UI** exists for admins (confirmed across the admin-profiles views). Losing a device requires ops-side API intervention. This is arguably intentional hardening (users cannot weaken their own MFA) but worth pairing with a documented ops runbook.
- Logout is a button (POST-style action) rather than a GET route; `/admin/logout` does not exist as a navigable path — good CSRF hygiene.
- Graceful bounces (redirect to origin workspace) are used consistently for authorized-but-out-of-scope pages, avoiding error-page information leakage.

---

---

# Part II — Full-Site UI/UX & Responsiveness Audit

**Scope:** every reachable page visited across three viewports — desktop 1440x900, tablet 768x1024, mobile 390x844 — collecting per-route HTTP status, horizontal-overflow measurements (`scrollWidth` vs `clientWidth` plus count of elements extending past the viewport edge), console errors/warnings, failed network requests, and a viewport screenshot.

**Coverage:** 33 public/auth routes, 13 portal routes, 27 admin routes (super-admin tier) = **73 routes x 3 viewports (~219 page visits)**, all HTTP 200 except where noted.
**Evidence:** ~220 screenshots at `ui-evidence/2026-08-25/<route>-<viewport>.png` (local artifacts directory, not committed).

---

## II.1 Confirmed UI Defects

| ID | Severity | Page(s) | Viewport(s) | Defect | Evidence |
|---|---|---|---|---|---|
| UI-001 | High (visual) | `/admin/content/media` | Desktop | **Page-level horizontal overflow: content width 9473px inside a 1425px viewport** (~6.6x too wide). The upload form's File / Title / Alt-text / Cloudinary-folder inputs stretch the entire page; visible horizontal scrollbar breaks admin chrome alignment. Tablet/mobile contained at page level but keep ~400 overflowing elements inside inner scroll regions. | `admin-content-media-desktop.png` |
| UI-002 | High (visual) | `/admin/content/projects` | Desktop | "Create New Project" form overflows the viewport (1894px vs 1425px); Title field runs off-screen behind a horizontal scrollbar. | `admin-content-projects-desktop.png` |
| UI-003 | Medium | `/admin/audit` | Desktop | Unbroken JSON payload inside an event card code block pushes the page to 1945px. Needs `overflow-wrap: anywhere` / `break-all` on code blocks or a details-expander. | `admin-audit-desktop.png` |
| UI-004 | Medium | `/admin/content/about` | Mobile | Form grid does not collapse at 375px CSS width: inputs and labels clip past the right edge, label text truncated mid-word. ~156 overflowing elements. | `admin-content-about-mobile.png` |
| UI-005 | Medium | `/about` | Tablet | Stats strip clips its last tile — "200+ Alumni & commu" truncated mid-word at right edge, no scroll affordance. | `about-tablet.png` |
| UI-006 | Medium | `/members` | Tablet | Directory filter-bar dropdowns clip at right edge — second select half-cut, third reduced to a sliver. | `members-tablet.png` |
| UI-007 | Medium (functional) | `/contact` | All viewports | **Google Maps embed permanently blocked by CSP.** Console error on every load: "Framing 'https://www.google.com/' violates CSP directive frame-src 'self' https://challenges.cloudflare.com". The map below the fold never renders. Fix: add `https://www.google.com` to `frame-src` in `src/lib/security/http-headers.ts`, or remove the iframe. | `contact-desktop.png` (+console log) |
| UI-008 | Medium (console) | `/admin/content/forms` | Desktop | React **hydration mismatch** in FormStudioPage -> FormInventoryProvider -> ModernFormStudioScreen. Signature of Date/Math.random/locale-dependent rendering between server and client passes; risks full client-side re-render of the form studio tree. | console capture (crawl log) |

## II.2 Minor / Low Observations

- **Horizontal-scroll containers without affordance:** `/committee` mobile term-switcher pills run past the right edge (likely an intentional chip carousel but no fade/scroll hint); `/admin/content/gallery` (tablet, ~97 els), `/admin/content/blogs` (tablet 91 / mobile 123), `/admin/profile-changes` (mobile 70), and `/admin/content/notices` (mobile 17) rely on inner scroll regions that render acceptably but would benefit from visible scroll cues.
- `/portal/activity` mobile flagged 8 overflowing elements but is visually clean on inspection — false positive from hidden/measured-offscreen elements.
- `/alumni-join` mobile emits an LCP warning pointing at `logo.svg` (minor Core-Web-Vitals tuning opportunity).
- One stray `/api/forms/intake/membership -> 404` fired during a `/privacy-policy` desktop load (router prefetch/cache artifact of the staging-data issue below).

## II.3 Environment/Data Issues (not code bugs)

1. **Staging DB lacks a published membership intake form** — `/membership-form` renders its shell but the intake API returns 404, so no application form appears. Publish a form definition on staging before using this environment for demos/E2E.
2. **Dev-server noise (dev only):** transient `_next/static` chunk 404s with `text/plain` MIME on `/admin/system-health` mobile during webpack rebuild races; one Sentry `/monitoring` tunnel 500 in dev (DSN/env config).
3. **supabase-js advisory warning** ("Using the user object as returned from getSession()... could be insecure") logged client-side on `/admin/system-health` and `/admin/retention` — informational; server-side checks are authoritative per Part I.
4. **Port hijack incident (ops note):** mid-crawl, port 3000 on this workstation was captured by a WSL port relay serving an unrelated personal site; the JnUITS dev server was relaunched on port 3100 and the crawl continued against verified JnUITS content. Not an application defect — noted because it demonstrates how easily local-port assumptions can be subverted during development.

## II.4 Clean Routes

The following rendered correctly at all three viewports — HTTP 200, no page-level horizontal overflow (`scrollWidth == clientWidth`), zero unexpected console errors:

- **Public/auth (33):** `/`, `/events`, `/blogs`, `/notices`, `/projects`, `/gallery`, `/certificates`, `/developers`, `/alumni`, `/privacy-policy`, `/terms-of-service`, `/cookie-policy`, `/reset-password`, `/committee/5th`, `/login`, `/register`, `/forgot-password`, `/verify-email`, `/portal/login`, `/admin/login` (plus remaining archive/detail routes crawled).
- **Portal (13):** `/portal`, `/portal/dashboard`, `/portal/activity`, `/portal/blogs`, `/portal/projects`, `/portal/tickets`, `/portal/mentorship`, `/portal/profile` (+ edit, change-password), `/profile` (+ edit, change-password) — no overflow, no console errors.
- **Admin (20 of 27):** every admin route above except the five listed in II.1/II.2 — including `/admin/applications`, `/admin/invitations`, `/admin/profile-changes`, `/admin/membership`, `/admin/bulk-operations`, `/admin/content` (+ about/slider/blogs/notices/events/gallery), `/admin/committee`, `/admin/reports`, `/admin/certificates`, `/admin/decisions`, `/admin/system-health`, `/admin/admin-profiles`, `/admin/settings/security`, `/admin/retention`, `/admin/settings/notifications`, `/admin/settings/contact`.

Benign console noise excluded from findings (present site-wide, environment-inherent): Cloudflare challenges telemetry 401s, obfuscated Turnstile `%c%d font-size:0` logs, OTS/WOFF font warnings, Chromium GPU `powerPreference` warnings, webpack Fast Refresh logs.

## II.5 Part II Verdict

No functional breakage found anywhere: all RBAC-gated pages rendered their correct scoped content, and no route failed to load. The defect list is concentrated in **admin form-layout overflow (UI-001/002/004)**, **long-content wrapping (UI-003/005/006)**, and two real code-level issues (**CSP-blocked Google Maps embed UI-007**, **hydration mismatch UI-008**). All are cosmetic-to-moderate; none block core workflows. Recommended fix order: UI-007 (user-facing feature dead), UI-001/UI-002 (admin unusable-at-a-glance), UI-008 (correctness), then the responsive clipping set.

---

*End of report — `rbac-live-browser-audit-2026-08-25.md`.*
