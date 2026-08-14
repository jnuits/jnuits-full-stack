# JnU AI & IT Fest 2026 Campaign Design

**Status:** Approved in conversation on 14 August 2026

**Objective:** Make JnU AI & IT Fest 2026 the primary current focus of the official JnUITS homepage while preserving the recognizable JnUITS design, canonical event architecture, production safety, and a clean manual Git rollback path.

## Protected baseline

- Production baseline branch: `main`
- Pre-Fest commit: `ee3ac238aa211793d0431559ecde93f80970c197`
- Remote backup branch: `backup/pre-ai-it-fest-2026`
- Remote annotated tag: `pre-ai-it-fest-2026`
- Isolated implementation branch: `codex/ai-it-fest-2026`
- Baseline verification: local `main` was clean and identical to `origin/main` before the backup references were created.

Git and GitHub are the rollback mechanism. The application will not gain a campaign feature flag, scheduled rollback, runtime campaign switch, or duplicate stored copy of the old homepage.

## Design principles

1. The Fest campaign is added before the current homepage content so it receives immediate visual priority.
2. Existing JnUITS navigation, footer, CMS data, slider data, statistics, programs, membership, values, advisor content, and university context remain intact.
3. The campaign uses the existing JnUITS blue, ink, gold, typography, spacing, shell width, button language, focus behavior, and light/dark theme tokens.
4. Violet and cyan are restrained campaign accents rather than a replacement site theme.
5. Core event facts live in the canonical `events` records. Temporary homepage code contains only presentation labels that the schema does not model, such as `Solo`, `Team`, and concise fee wording.
6. Registration remains on the existing Fest properties. JnUITS provides discovery, official event history, and external routing only.
7. No database migration or schema change is permitted for this campaign.

## Verified official sources

The sources were checked on 14 August 2026.

- Fest homepage: <https://itfest.jnuits.org.bd/>
- Fest event index: <https://itfest.jnuits.org.bd/events>
- Official Fest event API: <https://festapi.jnuits.org.bd/api/events>
- Official speakers page: <https://itfest.jnuits.org.bd/speakers>
- BrainChild overview: <https://brainchild.jnuits.org.bd/>
- BrainChild registration: <https://brainchild.jnuits.org.bd/register>
- BrainChild rulebook: <https://drive.google.com/file/d/1txSeyWJIOFxNW3XFUmjYZMrkN6uEemFj/view?usp=sharing>

The official Fest index contains exactly five current segments. Generic homepage metadata mentions programming contests and esports, but neither appears as a published Fest event, so neither will be invented or inserted.

## Production event inventory

All timestamps use `Asia/Dhaka`. The shared published start is 30 August 2026 at 09:00 Bangladesh time, encoded as `2026-08-30T03:00:00Z`. No official source publishes a reliable end time, so `ends_at` is `null` for all six records.

| JnUITS title | JnUITS slug | Category | Participation | Fee display | Registration deadline | Registration destination | Venue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| JnU AI & IT Fest 2026 | `jnu-ai-it-fest-2026` | `institutional` | Festival | Event-specific | None at umbrella level | No registration mode; CTA to Fest index | Ground Floor, Shahid Sajid Building and Central Auditorium, Jagannath University |
| AI & IT Olympiad | `ai-it-olympiad` | `competition` | Solo | BDT 200 | `2026-08-15T17:59:00Z` | <https://itfest.jnuits.org.bd/events/ai-it-olympiad> | Ground Floor of Shahid Sajid Building |
| TechUncut | `techuncut` | `institutional` | Solo admission | BDT 200 | `2026-08-15T17:59:00Z` | <https://itfest.jnuits.org.bd/events/techuncut> | Central Auditorium, Jagannath University |
| TechCare Zone | `techcare-zone` | `other-real-event` | Individual service | Free for registered Fest participants; BDT 100 visitor token | `2026-08-15T17:59:00Z` | <https://itfest.jnuits.org.bd/events/techcare-zone> | Ground Floor of Shahid Sajid Building |
| AI Ad-Venture | `ai-ad-venture` | `competition` | Team of 2-5 | BDT 300 per team | `2026-08-15T17:59:00Z` | <https://itfest.jnuits.org.bd/events/ai-ad-venture> | Ground Floor of Shahid Sajid Building |
| BrainChild Season 2.0 | `brainchild-season-2-0` | `competition` | Team of 2-3 | BDT 2,000 per team | `2026-08-20T17:59:59Z` | <https://brainchild.jnuits.org.bd/register> | Ground Floor of Shahid Sajid Building, Jagannath University |

Every segment uses `delivery_mode = offline`, `location_mode = venue`, `timezone = Asia/Dhaka`, and `registration_mode = external`. The umbrella event uses `registration_mode = none`, `cta_label = Explore all Fest events`, and `cta_url = https://itfest.jnuits.org.bd/events`.

The four non-BrainChild segment records do not duplicate their registration URL in `cta_url`. Their body copy includes the official source link. BrainChild may use a distinct evergreen `Explore BrainChild` CTA to its overview page while `registration_url` points to its registration page.

### Source conflict decisions

- BrainChild: the dedicated BrainChild overview, timeline, registration metadata, and structured offer consistently publish 20 August 2026 as the deadline. That dedicated registration property is more specific and more recently updated than the main Fest API's 15 August value, so the JnUITS record uses 20 August at 23:59:59 Bangladesh time.
- Deadline precision: the main Fest API publishes the four non-BrainChild deadlines at minute precision as `2026-08-15T23:59`, so the stored UTC value represents that exact minute as `2026-08-15T17:59:00Z`; it is not extended to the end of the minute. BrainChild's authoritative structured offer explicitly publishes `2026-08-20T23:59:59+06:00`, so its stored value preserves those source-provided seconds as `2026-08-20T17:59:59Z`.
- TechCare Zone: the API fee field says BDT 100 while the description says registered Fest participants receive the service free and general visitors pay a BDT 100 token charge. Public copy preserves both conditions rather than presenting a universal BDT 100 fee.
- End times: no reliable end time is published. The application must not manufacture a duration.
- Prizes: all five API records publish `prizeMoney = 0`; no cash prize claim is shown.
- TechUncut speakers: only M Manjur Mahmud and Nabila Khalid are presented as confirmed. The additional speakers remain unlisted until the official source confirms them.

## Media design

Official source images are copied into the configured JnUITS Cloudinary account under `jnuits/jnuits-full-stack/campaigns/ai-it-fest-2026` and registered in the existing `media_assets` table. Event rows reference those registered asset IDs through `cover_media_asset_id`.

The required source artwork is:

- Umbrella Fest artwork: `https://res.cloudinary.com/dbwbwwteo/image/upload/v1786029922/ChatGPT_Image_Aug_6_2026_09_24_46_PM_hrzm6x.png`
- Olympiad cover: `https://res.cloudinary.com/dbwbwwteo/image/upload/v1786288217/events/wppftrsdjijguyzoboal.png`
- TechUncut cover: `https://res.cloudinary.com/dbwbwwteo/image/upload/v1786206237/events/pqoqykn18hkodiyp5fdx.png`
- TechCare cover: `https://res.cloudinary.com/dbwbwwteo/image/upload/v1786206072/events/frz69uze8rulzkytkj4p.png`
- AI Ad-Venture cover: `https://res.cloudinary.com/dbwbwwteo/image/upload/v1786205719/events/m0bgyijodaq89sb2rcor.png`
- BrainChild campaign artwork: `https://res.cloudinary.com/dqmpifybz/image/upload/c_fill,w_1200,h_630,q_auto/v1786561665/BrainChild_Season_2.0_1_gj3qld.png`

Alt text identifies the event shown. No speaker image, sponsor logo, prize artwork, or generated substitute is introduced.

## Production content write workflow

The records use the existing `media_assets` and `events` tables. A controlled one-time production operation uses the configured server credentials because the user authorized Codex to create the records. Each row populates the existing `source` and `source_metadata` fields with verified provenance rather than introducing new provenance columns.

The umbrella record uses an official Fest-site source. The four main API segments use the official Fest API as their machine-readable source and retain their official detail URLs. BrainChild uses the dedicated BrainChild site as the authoritative deadline and registration source while retaining the main Fest API record and official API slug `brainchild-season-20` as secondary provenance. `source_metadata` records the verification date, source URL, API record URL or official slug where applicable, deadline source, source precision, and documented conflict resolution.

The operation follows these safety rules:

1. Query existing media public IDs, event slugs, and event titles before writing.
2. Abort on an unrelated slug or title collision; never blindly overwrite an existing event.
3. Reuse an exact task-owned media asset or event row when resuming after a partial attempt.
4. Upload/register official covers before inserting event rows.
5. Insert records as drafts first, return and record their IDs, then validate all stored fields.
6. Publish only after the permanent external-registration deadline correction is confirmed in the deployed production application. If deployment cannot be confirmed in this session, preserve the verified drafts and document publication as the remaining blocker instead of exposing misleading CTAs.
7. Verify all six public URLs, covers, statuses, deadlines, and external destinations after publication.
8. Record final row IDs, slugs, media IDs, and timestamps in `docs/AI_IT_FEST_2026_ROLLBACK.md`.

No seed catalog, migration, payment table, participant table, or registration form is added or changed.

## Permanent application corrections

### External registration lifecycle

The existing event mapping labels all external registrations as active before checking `registration_closes_at`. The public detail page also renders an external registration button whenever a URL exists.

The correction will:

- Derive `closed` for external registration at or after `registration_closes_at` or the event end boundary.
- Ignore `registration_open` for external mode because the admin action intentionally stores it as `false` outside internal registration.
- Render `Register externally` only when the derived state is `external`.
- Keep an evergreen, non-registration CTA independent from registration state.
- Align boundary comparisons with the database RPC by treating the exact deadline instant as closed.
- Pass derived closure state to the internal registration form so an expired form is not displayed before the API rejects it.

### Canonical homepage upcoming events

The current homepage queries legacy `content_posts` and maps published records to `Ongoing`, while the homepage filter only accepts `Upcoming`. The normal upcoming section therefore excludes live published events.

The permanent correction makes the homepage use the canonical `events` query and its existing lifecycle labels. This change remains after the campaign rollback and ensures the new Fest records and future events use one source of truth.

## Temporary homepage campaign

### Placement and hierarchy

The campaign is a server-rendered section at the top of `src/app/(public)/page.tsx`, before the current society hero. It includes:

1. A campaign hero naming Jagannath University IT Society as presenter.
2. Verified date, venue, tagline `Where Ideas Meet Intelligence`, and official artwork.
3. Primary CTAs to the Fest overview and official JnUITS event archive.
4. A four-card segment showcase for AI & IT Olympiad, TechUncut, TechCare Zone, and AI Ad-Venture, sourced from canonical published event records.
5. A separate, larger BrainChild core-event feature with its authoritative deadline, team size, fee, registration, tracking, and rulebook/overview routes. BrainChild is not duplicated in the normal card grid.
6. A final route to the official Fest event index.

During the campaign, `JnU AI & IT Fest 2026` is the single page `<h1>`. The preserved Jagannath University IT Society hero uses an `<h2>` with its existing visual class. Reverting the temporary campaign commit restores the original homepage `<h1>` semantics.

### Visual language

- Keep the shared `.shell` width, rounded-card language, pill buttons, 44-pixel targets, public typography scale, and existing theme toggle behavior.
- Build campaign styles in a dedicated CSS module so they do not expand the already large global cascade.
- Use `--brand-ink`, `--brand-blue`, `--brand-gold`, and semantic theme variables as the base palette.
- Limit cyan/violet to gradients, borders, small highlights, and focus-compatible accents.
- Do not use video, canvas effects, particle systems, new fonts, new animation libraries, or a countdown.
- Render useful content without JavaScript. Any subtle motion is CSS-only and disabled under `prefers-reduced-motion: reduce`.
- Use responsive image aspect ratios and existing Cloudinary transforms to minimize layout shift and payload size.

### Data flow

The server page requests the five Fest segment records from the canonical event layer by stable slug. It passes normalized event information into the campaign component.

Temporary presentation configuration contains only:

- stable slug order;
- short participation label;
- concise fee label;
- the four standard-card slugs and the separate BrainChild core-event slug;
- evergreen official overview links not represented by a registration field.

Dates, registration deadlines, lifecycle state, registration state, titles, summaries, venues, covers, and event detail URLs come from production event records. Missing or unpublished records are omitted from the card grid and logged server-side; the rest of the homepage still renders.

### Metadata

Temporary homepage metadata identifies both the campaign and JnUITS, keeps `https://jnuits.org.bd/` canonical, and uses the official umbrella artwork for Open Graph and Twitter previews. The title and description do not erase the organization identity.

No homepage JSON-LD is added because the repository has no existing structured-data boundary and the canonical event detail pages already carry the event-specific discovery path. This avoids introducing duplicate or conflicting event entities for a temporary campaign.

## Error handling and partial-state safety

- Database content creation is collision-aware and resumable only for rows positively identified as created by this campaign operation.
- A failed cover upload prevents the dependent event from being published; the event may remain a draft without a cover while the issue is corrected.
- An unavailable Fest API does not cause stored facts to be replaced by guesses. The verified 14 August inventory remains the input, and every external destination is rechecked immediately before publication.
- A missing campaign event does not fail the homepage request.
- Closed registration removes the active registration CTA while retaining the event detail and evergreen overview routes.
- Empty or invalid image data uses the existing event-image fallback and meaningful text content.
- Production writes, Git commits, and verification results are recorded separately so a code rollback never implicitly deletes event history.

## Accessibility and responsive requirements

- Exactly one logical `<h1>` on the campaign homepage.
- Ordered heading hierarchy for hero, showcase, BrainChild, and preserved JnUITS sections.
- Meaningful alt text for every official artwork asset.
- Native links for navigation and external registration, with clear external destinations.
- Visible focus states and at least 44-pixel interactive targets.
- Sufficient contrast in light and dark themes.
- No information conveyed exclusively through color or embedded image text.
- No horizontal overflow at 360, 375, 390, 768, 1280, and wide desktop widths.
- Reduced-motion users receive no decorative transitions or animations that are necessary to understand content.

## Testing and verification

### Focused automated coverage

- Clock-controlled unit tests for open external registration, exact-deadline closure, post-deadline closure, event-end closure, and internal-mode behavior.
- Public event-detail render tests confirming expired external CTAs are absent and evergreen CTAs remain.
- Canonical homepage upcoming-event tests proving published future events appear and past events do not.
- Campaign component DOM tests for one `<h1>`, heading order, verified CTA targets, alt text, missing-event tolerance, closed registration, and BrainChild prominence.
- Metadata assertions for title, description, canonical URL, and social image.
- Playwright coverage for homepage and new event pages at mobile, tablet, and desktop widths.

### Repository gates

Run and record actual outcomes for:

```text
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test e2e/smoke.spec.ts --project=chromium
```

Also inspect console errors, hydration warnings, keyboard navigation, focus visibility, image cropping, layout shift, external URLs, and registration status at a representative 360-390 pixel viewport and desktop width.

## Commit and rollback boundaries

Changes are split so permanent corrections and historical content survive the campaign rollback:

1. Permanent event lifecycle correction and tests.
2. Permanent canonical homepage upcoming-event correction and tests.
3. Production event/media records, recorded as external database actions with returned IDs.
4. Temporary Fest homepage campaign, metadata, scoped styles, and campaign tests.
5. Rollback documentation containing final SHAs, row IDs, exact paths, commands, and the ready-to-paste future Codex prompt.

The rollback document is `docs/AI_IT_FEST_2026_ROLLBACK.md`. Its primary strategy is `git revert` of only the temporary homepage campaign commit. It must preserve permanent lifecycle corrections, canonical event integration, production event history, media used by event history, unrelated newer development, and all security or bug-fix commits.

## Success criteria

- A visitor immediately understands that JnU AI & IT Fest 2026 is JnUITS's current flagship initiative.
- The original JnUITS visual identity and all existing homepage content remain recognizable and available.
- Six canonical JnUITS event records exist without duplicate slugs or titles.
- The five verified segments route to the correct official registration experiences.
- Four standard segment cards are shown once, and BrainChild Season 2.0 appears once as the separate core-event feature.
- BrainChild uses the authoritative 20 August deadline.
- TechCare presents its conditional fee accurately.
- Registration CTAs close at the exact Bangladesh deadline.
- No schema migration, feature flag, automatic rollback, duplicate registration engine, or unrelated refactor is introduced.
- GitHub contains the verified pre-Fest backup branch and annotated tag.
- Temporary homepage work can be selectively reverted without deleting event history or later development.
