# JnU AI & IT Fest 2026 Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six verified Fest records to the canonical production event system, correct registration lifecycle behavior, and deliver a temporary theme-native homepage campaign with four standard event cards and a separate core BrainChild feature.

**Architecture:** Permanent work fixes the canonical event lifecycle and homepage event query. A collision-safe content operator copies six official covers into the existing JnUITS Cloudinary/media registry and creates six provenance-rich event records without migrations. Temporary homepage code queries those records by slug and renders a scoped server-side campaign section that can later be reverted as one commit.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript 5, Supabase/Postgres, Cloudinary, Vitest, Testing Library, Playwright, CSS Modules.

## Global Constraints

- Preserve the pre-Fest baseline `ee3ac238aa211793d0431559ecde93f80970c197`, remote backup branch `backup/pre-ai-it-fest-2026`, and annotated tag `pre-ai-it-fest-2026`.
- Work only on `codex/ai-it-fest-2026`; never reset, force-push, or rewrite history.
- Add no migration, schema change, campaign feature flag, automatic rollback, registration engine, or payment flow.
- Keep existing homepage CMS data, slider data, navbar, footer, statistics, programs, membership, values, advisor content, and university context intact.
- Use `Asia/Dhaka`; store `2026-08-15T23:59` source deadlines as `2026-08-15T17:59:00Z` and the explicit BrainChild `2026-08-20T23:59:59+06:00` deadline as `2026-08-20T17:59:59Z`.
- Use JnUITS slug `brainchild-season-2-0`; retain official API slug `brainchild-season-20` in `source_metadata`.
- Render four standard cards only: AI & IT Olympiad, TechUncut, TechCare Zone, and AI Ad-Venture. Render BrainChild once, separately, as the core event.
- Populate existing `source` and `source_metadata` with verified official provenance.
- Keep permanent fixes and historical records out of the temporary homepage rollback commit.
- Publish production event records only after the external-deadline fix is verified in production.

---

## File Structure

**Permanent code and data tooling**

- `src/lib/content/events.ts` — registration state derivation, canonical homepage query, ordered slug query.
- `src/lib/content/event-registration-state.test.ts` — clock-controlled registration state tests.
- `src/lib/content/events-queries.test.ts` — canonical homepage and ordered-slug query tests.
- `src/app/(public)/events/[identifier]/page.tsx` — deadline-aware external/internal CTA rendering.
- `src/app/(public)/page.tsx` — permanent canonical upcoming-event consumption, then temporary campaign placement.
- `scripts/data/ai-it-fest-2026-events.mjs` — exact verified event/media manifest and provenance.
- `scripts/import-ai-it-fest-2026-events.mjs` — dry-run-by-default collision-safe media/event operator.
- `scripts/import-ai-it-fest-2026-events.test.mjs` — manifest, collision, row-building, and precision tests.
- `package.json` — `events:import-fest-2026` operator command.

**Temporary homepage campaign**

- `src/lib/content/ai-it-fest-2026.ts` — presentation-only slug order, fee, and participation labels.
- `src/components/homepage/AiItFestCampaign.tsx` — server-rendered hero, four-card grid, and BrainChild core feature.
- `src/components/homepage/ai-it-fest-campaign.module.css` — scoped responsive light/dark/reduced-motion styles.
- `src/components/homepage/AiItFestCampaign.test.tsx` — semantic and CTA regression coverage.
- `e2e/smoke.spec.ts` — campaign mobile/desktop, keyboard, overflow, and event-page smoke.

**Operations**

- `docs/AI_IT_FEST_2026_ROLLBACK.md` — actual baseline, commit SHAs, record/media IDs, rollback commands, and future Codex prompt.

### Task 1: Correct registration deadline behavior

**Files:**
- Create: `src/lib/content/event-registration-state.test.ts`
- Modify: `src/lib/content/events.ts`
- Modify: `src/app/(public)/events/[identifier]/page.tsx`

**Interfaces:**
- Produces: `deriveEventRegistrationState(row, registeredCount, now?) -> EventRegistrationState`.
- Produces: `isEventRegistrationWindowClosed(row, now?) -> boolean` for internal mutation targets.
- Consumers: public event list/detail mapping and the event detail registration form.

- [ ] **Step 1: Write clock-controlled failing tests**

Cover external before-deadline, exact-deadline, after-deadline, event-end, internal closed/open/full, and `none` behavior:

```ts
expect(deriveEventRegistrationState(externalEvent, 0, new Date("2026-08-15T17:58:59Z"))).toBe("external");
expect(deriveEventRegistrationState(externalEvent, 0, new Date("2026-08-15T17:59:00Z"))).toBe("closed");
expect(deriveEventRegistrationState({ ...externalEvent, registration_closes_at: null }, 0, new Date("2026-08-30T03:00:00Z"))).toBe("closed");
expect(deriveEventRegistrationState(internalEvent, 20, new Date("2026-08-14T12:00:00Z"))).toBe("full");
```

- [ ] **Step 2: Run the focused test and observe the missing export failure**

Run: `npx --no-install vitest run src/lib/content/event-registration-state.test.ts`

Expected: FAIL because `deriveEventRegistrationState` is not exported.

- [ ] **Step 3: Implement exact deadline semantics**

Refactor the existing private state function so external mode checks deadline/end while ignoring `registration_open`; internal mode retains the open flag and capacity checks. Use `<=` for the exact closing boundary.

```ts
export function deriveEventRegistrationState(
  row: Pick<EventRow, "capacity" | "ends_at" | "registration_closes_at" | "registration_mode" | "registration_open" | "starts_at">,
  registeredCount: number,
  now = new Date()
): EventRegistrationState {
  const closesAt = row.registration_closes_at ? new Date(row.registration_closes_at) : null;
  const endsAt = new Date(row.ends_at || row.starts_at);
  const timedOut =
    (closesAt && closesAt.getTime() <= now.getTime()) ||
    endsAt.getTime() <= now.getTime();

  if (row.registration_mode === "external") return timedOut ? "closed" : "external";
  if (row.registration_mode !== "internal") return "none";
  if (!row.registration_open || timedOut) return "closed";
  if (typeof row.capacity === "number" && registeredCount >= row.capacity) return "full";
  return "open";
}
```

- [ ] **Step 4: Gate public CTAs and the internal form**

Render `Register externally` only for `event.registrationState === "external"`. Pass `registrationOpen={event.registrationState === "open"}` into `RegistrationForm`. Leave a distinct evergreen `ctaUrl` available after registration closes.

- [ ] **Step 5: Run focused and existing event tests**

Run:

```text
npx --no-install vitest run src/lib/content/event-registration-state.test.ts src/lib/content/events-queries.test.ts src/lib/content/events-mutation-targets.test.ts
npm run typecheck
```

Expected: all focused tests pass and TypeScript exits successfully.

- [ ] **Step 6: Commit the permanent lifecycle correction**

```text
git add src/lib/content/event-registration-state.test.ts src/lib/content/events.ts "src/app/(public)/events/[identifier]/page.tsx"
git commit -m "fix(events): honor external registration deadlines"
```

### Task 2: Make homepage event reads canonical

**Files:**
- Modify: `src/lib/content/events.ts`
- Modify: `src/lib/content/events-queries.test.ts`
- Modify: `src/app/(public)/page.tsx`

**Interfaces:**
- Produces: `getHomepageUpcomingEvents(limit?: number) -> Promise<EventListItem[]>`.
- Produces: `getPublishedEventsBySlugs(slugs: readonly string[]) -> Promise<EventListItem[]>`, preserving requested order.
- Adds to `EventListItem`: `registrationClosesAt` and `registrationUrl` for campaign CTA rendering.

- [ ] **Step 1: Extend query mocks and write failing tests**

Add `gte` and `in` chain methods to `makeQuery`. Assert the homepage query filters `status = published`, uses Bangladesh day start, orders by `starts_at` then `id`, and limits to three. Assert slug lookup normalizes/deduplicates input and returns records in the requested order.

- [ ] **Step 2: Run query tests and observe missing-function failures**

Run: `npx --no-install vitest run src/lib/content/events-queries.test.ts`

- [ ] **Step 3: Implement bounded canonical queries**

Use `EVENT_LIST_SELECT`, `createPublicClient()`, `getRegistrationCountMap`, and `mapEventRow`. Return `[]` with a server-side error log on backend failure so the homepage remains available.

```ts
export async function getHomepageUpcomingEvents(limit = 3) {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 12);
  const result = await createPublicClient()
    .from("events")
    .select(EVENT_LIST_SELECT)
    .eq("status", "published")
    .gte("starts_at", getBangladeshDayStartIso())
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(boundedLimit);
  const rows = assertSupabaseSuccess(result, "Homepage event lookup failed").data || [];
  const counts = await getRegistrationCountMap(rows as EventRow[]);
  return (rows as EventRow[]).map((row) => mapEventRow(row, counts.get(row.id) || 0));
}
```

- [ ] **Step 4: Replace the legacy homepage event adapter**

Remove the `getPublishedEvents`/`EventPreview` dependency and local status/date filtering. Render `startsAt`, `title`, `summary`, and `slug` directly from `EventListItem`.

- [ ] **Step 5: Run focused tests, typecheck, and lint**

```text
npx --no-install vitest run src/lib/content/events-queries.test.ts src/lib/content/event-registration-state.test.ts
npm run typecheck
npm run lint
```

- [ ] **Step 6: Commit the permanent canonical query correction**

```text
git add src/lib/content/events.ts src/lib/content/events-queries.test.ts "src/app/(public)/page.tsx"
git commit -m "fix(home): use canonical upcoming events"
```

### Task 3: Build the verified production content operator

**Files:**
- Create: `scripts/data/ai-it-fest-2026-events.mjs`
- Create: `scripts/import-ai-it-fest-2026-events.mjs`
- Create: `scripts/import-ai-it-fest-2026-events.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `AI_IT_FEST_2026_MEDIA`, six source image definitions with project-folder public IDs.
- Produces: `AI_IT_FEST_2026_EVENTS`, six exact event definitions.
- Produces: `buildEventRows(assetIds, status)`, `findContentConflicts(existing, manifest)`, and a dry-run-by-default CLI.

- [ ] **Step 1: Write manifest and collision tests**

Assert exactly six unique slugs/titles, five external segments, one umbrella `none` mode, four minute-precision deadlines, the BrainChild second-precision deadline, the clean JnUITS BrainChild slug, and official API slug provenance.

```js
expect(AI_IT_FEST_2026_EVENTS.map((event) => event.slug)).toEqual([
  "jnu-ai-it-fest-2026",
  "ai-it-olympiad",
  "techuncut",
  "techcare-zone",
  "ai-ad-venture",
  "brainchild-season-2-0",
]);
expect(brainchild.sourceMetadata.officialApiSlug).toBe("brainchild-season-20");
expect(brainchild.registrationClosesAt).toBe("2026-08-20T17:59:59Z");
```

- [ ] **Step 2: Create the exact manifest**

Use start `2026-08-30T03:00:00Z`, `endsAt: null`, `timezone: "Asia/Dhaka"`, existing categories, verified summaries/body Markdown, official registration URLs, and these provenance sources:

```js
const provenance = {
  campaignId: "jnu-ai-it-fest-2026",
  verifiedAt: "2026-08-14",
  officialIndexUrl: "https://itfest.jnuits.org.bd/events",
};
```

For the main four, add `officialApiUrl`, `officialApiSlug`, `officialApiId`, `deadlineSourceValue: "2026-08-15T23:59"`, and `deadlinePrecision: "minute"`. For BrainChild, add its dedicated overview/register URLs, official API slug, both conflicting source values, `deadlineSourceValue: "2026-08-20T23:59:59+06:00"`, `deadlinePrecision: "second"`, and the authoritative-source decision.

- [ ] **Step 3: Implement the dry-run-by-default operator**

Load `.env.local`, create a Supabase service client, preflight titles/slugs, and refuse unrelated collisions. Reuse only rows/assets carrying `campaignId = jnu-ai-it-fest-2026`. Use `ensureCloudinaryImageAsset` with remote sources to copy artwork into `jnuits/jnuits-full-stack/campaigns/ai-it-fest-2026/*`. Insert drafts with returned IDs. Never print credentials.

- [ ] **Step 4: Add package command and run tests**

Add:

```json
"events:import-fest-2026": "node scripts/import-ai-it-fest-2026-events.mjs"
```

Run:

```text
npx --no-install vitest run scripts/import-ai-it-fest-2026-events.test.mjs
npm run events:import-fest-2026
```

Expected dry-run output: six planned draft events, six planned Cloudinary assets, no writes, no collisions.

- [ ] **Step 5: Commit the permanent event content tooling**

```text
git add package.json scripts/data/ai-it-fest-2026-events.mjs scripts/import-ai-it-fest-2026-events.mjs scripts/import-ai-it-fest-2026-events.test.mjs
git commit -m "feat(events): add AI and IT Fest 2026 content operator"
```

### Task 4: Create and verify production drafts

**Files:**
- No repository file changes.
- External writes: configured JnUITS Cloudinary account and production `media_assets`/`events` rows.

- [ ] **Step 1: Recheck official destinations immediately before writing**

Require HTTP success for the Fest homepage/index, all four detail routes, BrainChild overview/register/track, and the official event API. Compare current deadlines to the committed manifest; stop on a changed authoritative value.

- [ ] **Step 2: Run content preflight**

Run: `npm run events:import-fest-2026`

Expected: no unrelated title/slug collisions and a six-event/six-asset dry-run plan.

- [ ] **Step 3: Apply draft creation**

Run: `npm run events:import-fest-2026 -- --apply`

Expected: six Cloudinary asset IDs and six draft event IDs, each with the campaign provenance marker.

- [ ] **Step 4: Read back and verify exact stored values**

Verify title, slug, category, UTC timestamps, timezone, venue, registration mode/URL/deadline, CTA separation, cover ID, `source`, `source_metadata`, and `status = draft`. Record returned IDs for the rollback document.

### Task 5: Build the temporary campaign homepage

**Files:**
- Create: `src/lib/content/ai-it-fest-2026.ts`
- Create: `src/components/homepage/AiItFestCampaign.tsx`
- Create: `src/components/homepage/ai-it-fest-campaign.module.css`
- Create: `src/components/homepage/AiItFestCampaign.test.tsx`
- Modify: `src/app/(public)/page.tsx`

**Interfaces:**
- Consumes: ordered `EventListItem[]` from `getPublishedEventsBySlugs`.
- Produces: `AiItFestCampaign({ events })`, returning `null` without the umbrella/core records.
- Produces: four-card `STANDARD_EVENT_SLUGS` and `CORE_EVENT_SLUG = "brainchild-season-2-0"`.

- [ ] **Step 1: Write failing semantic component tests**

Assert one campaign `<h1>`, four standard cards, BrainChild once in a separate region, no duplicate core title, conditional registration CTAs, official overview/track links, alt text, and `null` when core inputs are absent.

```tsx
expect(screen.getAllByRole("article", { name: /AI & IT Olympiad|TechUncut|TechCare Zone|AI Ad-Venture/ })).toHaveLength(4);
expect(screen.getAllByText("BrainChild Season 2.0")).toHaveLength(1);
expect(screen.getByRole("region", { name: /BrainChild core event/i })).toBeInTheDocument();
```

- [ ] **Step 2: Create presentation-only configuration**

Define the four standard slugs, core slug, participation/fee labels, BrainChild overview/register/track/rulebook URLs, and Fest overview/index URLs. Do not duplicate dates, deadlines, venues, covers, summaries, or registration state.

- [ ] **Step 3: Implement the server-rendered component**

Render:

```tsx
<section aria-labelledby="ai-it-fest-title" className={styles.campaign}>
  <h1 id="ai-it-fest-title">JnU AI &amp; IT Fest 2026</h1>
  <div className={styles.eventGrid}>{standardEvents.map(renderStandardCard)}</div>
  <section aria-label="BrainChild core event" className={styles.brainchild}>
    {renderBrainChildFeature(coreEvent)}
  </section>
</section>
```

Use canonical event covers and lifecycle/registration labels. Registration links render only for `registrationState === "external"`; JnUITS detail and evergreen official overview links remain available.

- [ ] **Step 4: Add scoped responsive styles**

Use existing theme tokens, a two-column desktop/two-column tablet/one-column mobile standard grid, a larger BrainChild split layout, 44-pixel targets, visible focus, light/dark support, and reduced-motion overrides. Add no dependency or global campaign selector.

- [ ] **Step 5: Integrate campaign data and metadata**

Fetch all six slugs with `getPublishedEventsBySlugs`. Insert the campaign before the preserved society hero. Change the preserved society hero from `<h1>` to `<h2 className="hp-h1">`. Add canonical `/`, JnUITS-aware campaign title/description, and official umbrella social image metadata.

- [ ] **Step 6: Run component, query, type, and lint checks**

```text
npx --no-install vitest run src/components/homepage/AiItFestCampaign.test.tsx src/lib/content/events-queries.test.ts src/lib/content/event-registration-state.test.ts
npm run typecheck
npm run lint
```

- [ ] **Step 7: Commit all temporary campaign work together**

```text
git add "src/app/(public)/page.tsx" src/components/homepage/AiItFestCampaign.tsx src/components/homepage/AiItFestCampaign.test.tsx src/components/homepage/ai-it-fest-campaign.module.css src/lib/content/ai-it-fest-2026.ts
git commit -m "feat(home): promote JnU AI and IT Fest 2026"
```

This commit is the primary future rollback target.

### Task 6: Extend browser coverage

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: Add campaign responsive and semantic assertions**

At 375, 768, and 1280 widths, assert the campaign heading, exactly four standard cards, one BrainChild core region, visible JnUITS identity, no horizontal overflow, and working CTA hrefs.

- [ ] **Step 2: Add event detail registration-state smoke**

Assert each published Fest route renders its title/cover and that closed external registration does not expose `Register externally` after the deadline.

- [ ] **Step 3: Run Chromium smoke locally**

Run: `npx playwright test e2e/smoke.spec.ts --project=chromium`

Expected: all smoke tests pass with no console or hydration errors.

- [ ] **Step 4: Fold E2E coverage into the temporary campaign commit**

Use `git commit --amend --no-edit` so the single temporary rollback commit includes its E2E coverage.

### Task 7: Run full verification and prepare publication

**Files:**
- No planned source edits; fix only failures caused by this work.

- [ ] **Step 1: Run repository gates**

```text
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test e2e/smoke.spec.ts --project=chromium
```

- [ ] **Step 2: Perform real-browser visual QA**

Inspect homepage and six event pages at 360-390 pixels, 768 pixels, 1280 pixels, and wide desktop. Check light/dark themes, keyboard focus, image crops, CTA wrapping, reduced motion, console, hydration, and overflow.

- [ ] **Step 3: Verify every external URL**

Click Fest homepage/index, four segment detail/registration routes, BrainChild overview/register/track/rulebook, and speaker links. Record any official-source outage separately from application failures.

- [ ] **Step 4: Push the verified branch**

Run: `git push`.

- [ ] **Step 5: Gate production publication**

Confirm the permanent lifecycle commit is deployed to `https://jnuits.org.bd`. If deployment is not yet possible because branch merge/release authority is required, leave all six verified rows as drafts and report that single blocker. Once deployed, run the operator's publication mode against only task-owned IDs and verify the six public JnUITS event URLs.

### Task 8: Create the exact rollback document

**Files:**
- Create: `docs/AI_IT_FEST_2026_ROLLBACK.md`

- [ ] **Step 1: Record actual Git and database values**

Include baseline SHA, backup branch/tag, permanent lifecycle/query/tool commits, temporary homepage commit, exact changed paths, six event IDs/slugs, six media IDs/public IDs, and publication timestamps/status.

- [ ] **Step 2: Write exact rollback commands**

Primary strategy:

```text
git switch main
git pull --ff-only origin main
$temporaryHomepageCommit = git log --format=%H --grep='^feat(home): promote AI and IT Fest 2026$' -1
git revert $temporaryHomepageCommit
```

The completed document records the resolved commit as a literal SHA and explains how to preserve later conflicting hunks.

- [ ] **Step 3: Add the customized copy-paste future Codex prompt**

The prompt names the actual temporary commit, backup tag, file paths, and exact recommended revert command. It explicitly preserves event records, media used by history, permanent fixes, and newer development.

- [ ] **Step 4: Commit and push documentation**

```text
git add docs/AI_IT_FEST_2026_ROLLBACK.md
git commit -m "docs: record AI and IT Fest 2026 rollback procedure"
git push
```

- [ ] **Step 5: Re-run final Git and production verification**

Confirm clean worktree, remote branch parity, backup refs, implementation commit classification, production record state, and every reported test result before declaring completion.
