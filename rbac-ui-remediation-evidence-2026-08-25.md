# RBAC Live Browser Audit — Remediation Evidence

**Date:** 2026-08-25
**Parent report:** `rbac-live-browser-audit-2026-08-25.md` (Part II — Full-Site UI/UX & Responsiveness Audit)
**Scope:** All 8 confirmed UI defects (UI-001 … UI-008) identified in Part II.
**Verification method:** Every fix was applied, then re-measured live on the dev server (`localhost:3100`, staging Supabase) with the same Playwright harness used during the audit: page scrollWidth vs clientWidth, count of visible elements extending past `innerWidth + 8` ("wide els"), console error/warning capture, HTTP status, hydration-error capture, and viewport screenshots at desktop 1440×900 / tablet 768×1024 / mobile 390×844.
**Evidence screenshots:** `ui-evidence/2026-08-25/<slug>-<viewport>-fixed.png` (originals from the audit kept unsuffixed for before/after comparison).

---

## Result Summary

| ID | Route / Surface | Defect | Status | After-fix metric |
|----|-----------------|--------|--------|------------------|
| UI-001 | `/admin/content/media` | Page-level horizontal overflow, sw=9473 vs cw=1425 (~6.6×) | ✅ FIXED | sw=cw, 0 wide els, all 3 viewports |
| UI-002 | `/admin/content/projects` | Create-form overflow, sw=1894 vs cw=1425 | ✅ FIXED | sw=cw, 0 wide els, all 3 viewports |
| UI-003 | `/admin/audit` | Unbroken JSON `<pre>` expands grid track, sw=1945 | ✅ FIXED | sw=cw, 0 wide els, all 3 viewports |
| UI-004 | `/admin/content/about` (mobile) | Form inputs/labels clipped at right edge (~156 wide els) | ✅ FIXED | sw=cw, 0 wide els at 375px |
| UI-005 | `/about` (tablet) | Stats-strip labels truncated ("200+ Alumni & commu") | ✅ FIXED | 0 clipped stats at 768px **and** 769px |
| UI-006 | `/members` (tablet) | Filter-bar dropdowns clipped at right edge | ✅ FIXED | sw=cw, 0 wide els at 768px |
| UI-007 | `/contact` (all viewports) | Google Maps iframe permanently blocked by CSP `frame-src` | ✅ FIXED | iframe measured >50×50 px ("rendered") on all 3 viewports, zero CSP violations |
| UI-008 | `/admin/content/forms` | React hydration mismatch (differing element ids server vs client) | ✅ FIXED | 3 consecutive reloads: 0 hydration errors, deterministic DOM ids |

Regression gates after patching: `npm run lint` PASS · `npm run typecheck` PASS · `npm test` 162 files / 1,087 tests PASS (the single suite-load failure, `scripts/import-ai-it-fest-2026-events.test.mjs`, pre-dates this work and is tracked separately in the static audit §7.1).

---

## Per-Finding Details

### UI-001 + UI-002 — Admin content grid blowout (media, projects)

**Root cause (established by live bisect, not guessed):**
1. Hiding every form on the media page still left `scrollWidth = 9368` → the media cards were the cause, not the upload form. `.admin-card-row__title` renders raw Cloudinary public_ids with `white-space: nowrap`; its enormous min-content contribution forces auto-fit grid tracks to full text width regardless of the ellipsis overflow rule.
2. On both pages, bare `<section>` children inside `display:grid` containers lacked `min-width: 0`. Grid/flex items default to `min-width: auto`, so any intrinsically wide child stretches the track instead of being constrained.

**Fix — `src/app/globals.css`:**
- `.admin-card-row { min-width: 0 }`; `.admin-card-row__title/__meta { overflow-wrap: anywhere }`.
- New containment block scoped to `.admin-content`: `min-width: 0` applied to direct children of grids, `[class*="grid-cols"]` containers, and an explicit list of admin layout components (`.admin-media-workspace`, `.admin-media-card`, `.admin-review-card`, `.admin-slider-add-form`, `.section-band`, etc.).
- `.input-label { min-width: 0 }` + `.input-label > input/select/textarea { min-width: 0; max-width: 100% }` so form controls shrink within tracks.
- `.portal-form-grid { grid-auto-columns: minmax(0, 1fr) }` against implicit-track intrinsic blowout.
- Supporting fix: long hint badges (`.abadge`) changed from `white-space: nowrap` to normal wrapping (`overflow-wrap: anywhere`, `max-width: 100%`) — these were independently measuring up to 439px on mobile.

**Before:** media desktop `sw=9473/cw=1425`, 406 wide els; projects desktop `sw=1894/cw=1425`, 64 wide els.
**After:** media desktop/tablet/mobile `sw == cw`, 0 wide els each; projects identical. Screenshots: `admin-content-media-*-fixed.png`, `admin-content-projects-*-fixed.png`.

### UI-003 — Audit Explorer JSON payload overflow

**Root cause:** metadata preview used `<pre class="overflow-x-auto">` inside `article.route-tile` inside a CSS grid; the unbreakable single-line JSON's min-content expanded the grid item (grid items default `min-width:auto`), pushing the whole page to 1945px instead of scrolling locally.
**Fix — `src/app/admin/audit/page.tsx`:** article gets `min-w-0`; `<pre>` changed to `whitespace-pre-wrap [overflow-wrap:anywhere]` (content is already capped at 220 chars, so wrapping is safe).
**After:** desktop/tablet/mobile `sw == cw`, 0 wide els. Screenshot: `admin-audit-desktop-fixed.png`.

### UI-004 — About-page editor clipped on mobile

**Root cause:** same unconstrained-grid-item class as UI-001/002 plus nowrap badges; the stats/timeline form grids did not collapse their min-content at 375px.
**Fix:** covered by the shared containment rules above (no page-specific change needed).
**After:** mobile `sw = 375 = cw`, zero wide elements; previously ~156. Screenshot: `admin-content-about-mobile-fixed.png`.

### UI-005 — Public /about stats strip truncation on tablet

**Root cause (media-query gap, verified at the exact boundary):** the mobile override applied at `max-width: 767px` and the tablet override at `min-width: 769px`…`max-width: 1099px`. At exactly **768px neither applied**, so the base two-column `.about-hero` layout squeezed the 5-column stats strip into a ~280px column with `overflow: hidden` — clipping the last label ("200+ Alumni & commu").
**Fix — `src/app/globals.css` (~line 6780):** tablet query widened to `@media (min-width: 768px) and (max-width: 1099px)` so the hero collapses to a single full-width column at 768px.
**After:** at 768px **and** 769px: hero 1-col, five `.about-stat` boxes each 136px wide, `scrollWidth ≤ clientWidth + 2` on all five (0 clipped); mobile 390px unchanged and correct (116px each). Screenshot: `about-tablet-fixed.png`.

### UI-006 — Members directory filter bar clipped on tablet

**Root cause:** the filter row's 5-column explicit grid (`~964px` minimum content width) activated at Tailwind's `sm:` breakpoint (640px) — far below what its contents need — while the "Filters" drawer fallback only appeared below `sm:`. A 768px tablet got the cramped desktop layout.
**Fix — `src/components/members/member-directory-filters.tsx`:** desktop grid moved from `sm:grid-cols-[…]` to `lg:grid-cols-[minmax(18rem,1.3fr)_11rem_minmax(14rem,1fr)_11rem_auto] sm:grid-cols-2 lg:items-center`; drawer button/wrapper/container changed `sm:hidden → lg:hidden`; inline select stack wrapper `hidden sm:contents → hidden lg:contents`. Tablets now use the same 2-column + drawer UX as mobile; ≥1024px keeps the full inline row.
**After:** tablet `sw = 753 = cw`, 0 wide els; desktop unchanged. Screenshot: `members-tablet-fixed.png`.

### UI-007 — Google Maps embed blocked by CSP

**Root cause:** `src/lib/security/http-headers.ts` declared `frame-src 'self' https://challenges.cloudflare.com`, but `src/app/(public)/contact/page.tsx:45` embeds `https://www.google.com/maps/embed?pb=…` — blocked in every browser session ("Framing 'https://www.google.com/' violates CSP directive frame-src").
**Fix:** frame-src extended to `'self' https://challenges.cloudflare.com https://www.google.com`.
**Verification:** programmatic check of the maps iframe bounding box on `/contact` — width/height > 50px ("rendered") on desktop, tablet, and mobile; **zero** CSP/frame-src console violations on any load. `src/lib/security/http-headers.test.ts` still passes (2/2). Screenshots: `contact-{desktop,tablet,mobile}-fixed.png`.

### UI-008 — React hydration mismatch in Form Studio

**Root cause (reproduced with React's diff output):** module-level mutable counter `let editorKeySequence = 0` in `src/lib/forms/form-studio-definition.ts:67`, consumed by `createStudioEditorKey()`. The starter fields are built inside a `useState` initializer that runs during SSR *and* again during client hydration; the server module instance persists across requests (counter had advanced to 8) while the fresh client bundle restarts at 1 → guaranteed attribute mismatch (`id`, `htmlFor`, `aria-describedby`) whenever the server had rendered the page before.
**Fix:**
- `form-studio-definition.ts`: `createStudioEditorKey(seed?: string)` returns the deterministic `studio-field-${seed}` when seeded (SSR-safe); unseeded calls retain the counter for purely client-side interactions.
- `modern-form-studio-screen.tsx` `starterFields()`: all ten starter keys now seeded with stable field identifiers (`full_name`, `email`, `consent`, `student_id`, `department_code`, `batch_label`, distinct phone seeds per context). The add-custom-question handler intentionally keeps the counter — it never runs during SSR.
**Verification:** three consecutive reloads captured **zero** hydration errors; DOM ids are deterministic (`form-studio-help-studio-field-full_name`, `-email`, `-student_id`, `-department_code`, `-batch_label`, `-starter_phone`, `-consent`). `form-studio-definition.test.ts` (41 tests) and `modern-form-studio-screen.dom.test.tsx` (16 tests incl. axe checks) pass unchanged. Screenshot: `admin-content-forms-desktop-fixed.png`.

---

## Minor observations (Part II §II.2) — disposition

- `/committee` mobile term-pill row: inspected programmatically — it is a genuine horizontal scroller (`overflow-x-auto`, 135px scrollable) whose scrollbar is hidden by design (`[scrollbar-width:none]`). Intentional chip-row pattern; left unchanged.
- Inner-scroll tables/chips on gallery/blogs/notices/profile-changes: contained within scroll regions, visually acceptable — unchanged.
- `/portal/activity` mobile "wide els" flag: false positive (confirmed clean visually during the audit).
- `/alumni-join` logo.svg LCP warning: informational only; no action taken.

## Environment notes (transient, not regressions)

During re-verification, `/about` returned two transient 500s and `/members` one: server-side `JSON.parse` of a truncated upstream response plus dev-server Fast Refresh churn while CSS edits recompiled. Both routes were re-tested immediately after: 4/4 and 3/3 consecutive HTTP 200s, and the full re-crawl shows them clean across all viewports. Not related to any patch (no data-fetching code was modified).

## Files Changed

| File | Purpose |
|------|---------|
| `src/lib/security/http-headers.ts` | UI-007 frame-src allow Google Maps |
| `src/app/globals.css` | UI-001/002/004/005 containment rules, badge wrapping, tablet query boundary |
| `src/app/admin/audit/page.tsx` | UI-003 JSON pre-wrap + min-w-0 |
| `src/components/members/member-directory-filters.tsx` | UI-006 responsive breakpoint restructure |
| `src/lib/forms/form-studio-definition.ts` | UI-008 deterministic editor keys |
| `src/components/admin/modern-form-studio-screen.tsx` | UI-008 seeded starter fields |

No dummy data was created on staging at any point; no state outside the working tree was modified.

*End of remediation evidence — `rbac-ui-remediation-evidence-2026-08-25.md`.*
