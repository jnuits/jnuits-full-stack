# JnU AI & IT Fest 2026 rollback and handoff

This document records the exact production-safe rollback for the temporary JnU AI & IT Fest 2026 homepage campaign. The event lifecycle/query fixes and the content operator are permanent and must stay in place.

## Safety baseline

- Baseline commit: `ee3ac238aa211793d0431559ecde93f80970c197`
- Remote backup branch: `backup/pre-ai-it-fest-2026`
- Annotated backup tag: `pre-ai-it-fest-2026`
- Implementation branch: `codex/ai-it-fest-2026`
- Pull request: <https://github.com/jnuits/jnuits-full-stack/pull/152>

Both backup refs resolve to the baseline commit. They are historical safety references, not the preferred rollback method after newer production work exists.

## Commit boundaries

Keep these permanent commits:

- `02ff58b` - external-registration deadline lifecycle fix
- `9ec6fea` - canonical homepage upcoming-event query
- `51de09e` - idempotent AI & IT Fest 2026 content operator

The temporary homepage campaign is isolated in this commit:

- `361c2f2` - AI & IT Fest 2026 homepage promotion and its browser coverage

The temporary commit owns the campaign-specific changes in:

- `src/app/(public)/page.tsx`
- `src/components/homepage/AiItFestCampaign.tsx`
- `src/components/homepage/AiItFestCampaign.dom.test.tsx`
- `src/components/homepage/ai-it-fest-campaign.module.css`
- `src/lib/content/ai-it-fest-2026.ts`
- `e2e/smoke.spec.ts`

The homepage keeps the normal JnUITS visual system and society hero. It renders four standard Fest event cards and a separate, non-duplicated BrainChild Season 2.0 core-event feature.

## Preferred homepage rollback

After the campaign ends, revert only the temporary commit on the then-current main branch:

```powershell
git switch main
git pull --ff-only origin main
git revert 361c2f2
git push origin main
```

If later development touched one of the same files, resolve conflicts by removing only the campaign-specific imports, metadata, section, components, styles, constants, and gated Fest browser tests introduced by `361c2f2`. Preserve newer unrelated changes and all three permanent commits listed above.

Do not reset production to the backup branch or tag once main has advanced. That would discard unrelated work. Use the backup refs only to inspect the exact pre-campaign state.

## Production content inventory

The import created six event records as drafts. At the time this document was written, every row had `status = draft` and `published_at = null`.

| Event | Slug | Event ID | Media ID |
| --- | --- | --- | --- |
| JnU AI & IT Fest 2026 | `jnu-ai-it-fest-2026` | `eddc0ac6-8f4e-4858-80e0-c6b875bd91ab` | `94557503-ac55-4cfe-a566-6457e13a7603` |
| AI & IT Olympiad | `ai-it-olympiad` | `7fa99aec-e2c4-4cbf-b98b-512a43c4cc5d` | `9f45c6b4-222f-4a64-aa39-32ce727455ed` |
| TechUncut | `techuncut` | `c2ffb68f-6608-4b47-8d31-bccbff4a9d37` | `8f0d9dd0-0f26-4828-ad4f-207bfb1f2152` |
| TechCare Zone | `techcare-zone` | `a26224b4-96c6-463a-8d08-6bca9a7a39ef` | `43fa4778-8448-4e6c-9414-94b76e9d4ea5` |
| AI Ad-Venture | `ai-ad-venture` | `3b366189-61d5-48e0-8069-33c994470642` | `583a335e-5512-473b-95c3-c360c893d031` |
| BrainChild Season 2.0 | `brainchild-season-2-0` | `b2d8219d-9ccf-493d-80d7-9587023f150e` | `883eb7f9-828b-4122-a673-250f089defa8` |

The records use the existing schema. No migration was added. Their `source` and `source_metadata` fields preserve verified official Fest/API provenance. The general event deadline retains the official minute precision (`2026-08-15T23:59+06:00`); BrainChild retains the source's exact second precision (`2026-08-20T23:59:59+06:00`).

The media public IDs are under `jnuits/jnuits-full-stack/campaigns/ai-it-fest-2026/`, with the final segment matching each event slug.

## Publication gate

Do not publish the six rows before `02ff58b`, `9ec6fea`, and `51de09e` are merged and deployed. After production deployment is confirmed, publish through the guarded operator:

```powershell
npm run events:import-fest-2026 -- --apply --publish
```

The operator revalidates the official sources, checks ownership of all six existing event/media rows, refuses collisions, and performs an exact readback.

Then run the live campaign browser checks:

```powershell
$env:PLAYWRIGHT_EXPECT_FEST_CAMPAIGN='1'
npx --no-install playwright test e2e/smoke.spec.ts --project=chromium
Remove-Item Env:PLAYWRIGHT_EXPECT_FEST_CAMPAIGN
```

Record the publication timestamps in the release notes or deployment log. They are intentionally not invented in this document.

## Content handling after homepage rollback

The normal campaign rollback reverts `361c2f2` only. Keep the six event records and media assets as historical event content; do not delete them as part of the homepage rollback. If the organization later decides to hide the event pages, change the six known rows back to `draft` through the normal event administration workflow and verify their `published_at` state. Treat media deletion as a separate, explicitly approved operation.

## Prompt for a future Codex rollback task

> In `jnuits-full-stack`, remove the temporary JnU AI & IT Fest 2026 homepage campaign by reverting commit `361c2f2` on the current main branch. Preserve all newer unrelated development, the event/media records, and permanent commits `02ff58b`, `9ec6fea`, and `51de09e`. Use `backup/pre-ai-it-fest-2026` and tag `pre-ai-it-fest-2026` only for comparison. Resolve conflicts by removing only the campaign-specific changes listed in `docs/AI_IT_FEST_2026_ROLLBACK.md`. Run lint, typecheck, tests, production build, and browser smoke before pushing the rollback.
