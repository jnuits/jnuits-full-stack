# Remaining audit acceptance — 2026-10-07

This follow-up resumes the approved audit-remediation plan after the profile/workplace patch reached production. It supplements the preserved local remaining-work document without modifying it. Implementation and acceptance are distinct: unavailable owner/provider evidence remains open.

## Verified baseline and work completed

Remote/primary main and the actual `jnuits.org.bd` deployment agree on `4ecd4f7dfc47518d48708593cbc32c0d155b4c9c`. Vercel deployment `dpl_3PrusFmXDNvJZFcgiASUW62LKQbu` is READY. Its Quality Gate, Diff Check and Production Readiness Actions passed. Hosted Supabase `fsirdkjgrcocowxqjhjg` has 117 migrations, latest `20261005165555`; public tables without RLS and prohibited effective browser table privileges both remain zero. No migration was applied during this follow-up.

Public production browser evidence uses Chromium 149.0.7827.55, Firefox 151.0 and WebKit 26.5, widths 375/768/1280, and both actual themes: 144 shell checks/screenshots, actual providers, no form submissions. Layout overflow, hydration, landmarks, theme and newsletter controls passed. **The complete strict gate failed**: 27 provider-CSP observations involved Vercel Toolbar frames; six assertions assumed fixture-only event/category conditions. Two WebKit home-page error observations were also recorded; the script did not retain their messages, so their cause is not established. Do not claim zero runtime/provider errors.

The event notification card is conditional on no featured event, and category tabs require more than one category. Current production has a featured event and one blog category, so those absent controls are expected. Disposable fixtures retain multi-category, older-page and event-anchor interaction evidence. No real content was added to manufacture those states.

The unchanged dependency gate also detected high advisory [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), added to the advisory database after the previous release. The lockfile upgrades Next's optional sharp dependency from 0.35.4 to 0.35.5 within its existing range, including matching platform/libvips packages and deduplicated WASM runtime. No new dependency override or audit exception is introduced. The unchanged production/development dependency audit passes after the patch. Production image-library rollout remains tied to the reviewed release.

A separate live probe found a real sitemap defect: published blog links used `/blog/...`, returning 404, while the existing `/blogs/...` article route and canonical URL return 200. The projection is corrected to `/blogs/` with a Bengali-slug regression. Deployment of the correction and a fresh live sitemap check are required before closing this finding.

The current sitemap has 159 unique URLs, truthful modification dates for the published blog/notice, and excludes the archived notice. The public notice detail has canonical/description metadata. Missing project and archived notice details return 404. Current hosted data contains one published blog, one published notice, one archived notice, two published events and no projects; live multi-page blog and project-detail acceptance cannot be claimed from it.

Database operator EXPLAIN measurements: blog LIMIT 24 projection uses `content_posts_public_blog_archive_idx` (0.067 ms execution); body-free notice LIMIT 12 projection uses `content_posts_admin_notice_archive_idx` plus an in-memory sort (0.109 ms); actual notice-summary RPC 7.812 ms. These are tiny-dataset, operator-context measurements, excluding app network latency, RLS-context cost and capacity. Automatic approval review rejected the original notice benchmark's body projection; the body-free alternative completed without retrieving private notice content.

Three low-rate production GET samples per route had total durations: home 281–400 ms; blogs 350–385 ms; notices 240–291 ms; projects 222–270 ms. HTML remains private/no-store. There is no comparable pre-nonce production timing baseline, so this is current latency evidence, not a measured rendering-cost delta or load test.

## WebKit retry diagnosis and correction (OPS-08)

The preserved CSP trace proves the unnonced candidate was inserted, but its violation-event boolean remained false. The failed attempt did not measure script execution, so it cannot establish a CSP bypass. The revised test requires a permitted nonced parser control after the candidate to execute and the unnonced candidate to remain unexecuted. Browser-local counterexamples prove the assertion rejects both a missing policy and an incorrectly nonced control.

The keyboard trace spent 23,691 ms loading home in a combined 30-second multi-route test, then exhausted its shared budget during later login checks. Public, admin-login and portal-login keyboard checks now run independently and wait for DOMContentLoaded. Existing focus assertions/deadlines are retained. No login submission or authentication-policy change is involved.

Live public validation: 12 WebKit cases passed across three repetitions without retries, plus four Chromium and four Firefox cases without retries. These tests verify CSP execution and public/login focus, not authenticated MFA or mailbox delivery. Required release CI on the final revision remains a merge gate. No repeated independent whole-branch audit was performed.

## Remaining register and owner checklist

| ID | Current status | What closes it |
| --- | --- | --- |
| OPS-01 | OPEN — owner confirmed newsletter settings are not configured | Dedicated provider settings and owner-performed consenting-mailbox/CAPTCHA/confirmation/suppression acceptance |
| OPS-02 | OPEN — real authenticated remote acceptance | Owner existing-factor/native AAL2/password, stale-session and eligible scoped-email evidence |
| OPS-03 | PARTIAL — public layouts/themes verified; toolbar CSP observations unresolved | Resolve intended toolbar behavior, real CAPTCHA/provider checks and authenticated/error/detail acceptance; rendering-cost comparison remains unmeasured |
| OPS-04 | PARTIAL — live sitemap defect corrected in code; query/date/notice evidence captured | Deploy correction and verify live URLs; keep missing live project/multi-page data limitations explicit |
| OPS-05 | OPEN — current grants clean, provider-owner defaults still broad | Supported Supabase owner/provider correction and future-object privilege proof |
| OPS-06 | OPEN — owner confirmed backup settings are not configured | Private offsite recovery point, independent retrieval/decryption, production-sized isolated restore and timing |
| OPS-07 | PARTIAL — recovery inventory refreshed | Independent byte recovery for Cloudinary, Drive certificates and profile avatars |
| OPS-08 | Targeted correction and validation complete; final release CI pending | Required CI and recorded release revision; do not describe historical retries as first-pass successes |
| OPS-09 | OPEN | Outstanding acceptance, then deliberate merged-artifact cleanup; protected backup branch requires owner approval |

### Newsletter and authentication

Configure `RESEND_NEWSLETTER_API_KEY`, `RESEND_NEWSLETTER_SEGMENT_ID` and `RESEND_NEWSLETTER_TOPIC_ID` privately using [newsletter operations](newsletter.md). Preserve transactional credentials. Use the dedicated Segment and public opt-out Topic; do not send broadcasts as a test. The owner performs mailbox steps personally: explicit consent and real CAPTCHA; generic acceptance; delivered confirmation; no activation from GET; explicit confirmation POST; idempotent repeat; correct Segment/Topic; preferences/unsubscribe respected. Use provider-supported disposable fixtures for harmful-delivery cases. Report timestamps and outcomes only, never addresses, tokens or message links.

Follow [admin verification operations](admin-verification.md) for genuine sign-in and existing-factor verification. Record native AAL2, current-password unlock, stale-session recovery and legitimate routine access with the existing optional-enforcement setting. Check eligible scoped email independently; it cannot replace AAL2 or rescue an invalid session. Never change real roles, approve/reject real requests, toggle enforcement, enroll/remove factors or manufacture enrollment history for testing. Unknown legacy enrollment remains unknown. The previous owner-requested workplace cancellation is already recorded; it is not permission for new mutations.

### Vercel Toolbar

The owner was asked to choose production toolbar behavior. Until answered, provider settings and CSP remain unchanged. Prefer disabling the optional toolbar in production when it is not required, using the supported project/team General → Vercel Toolbar setting. If it is required, review scoped compatibility against [Vercel's toolbar/CSP guidance](https://vercel.com/docs/vercel-toolbar/managing-toolbar). Do not add script `unsafe-inline`/`unsafe-eval`, suppress CSP observations or use a toolbar-skip request header as proof that normal production is clean.

### Provider-owned defaults (support request draft)

Submit this through the owner's normal Supabase support channel; no message has been sent:

> Project fsirdkjgrcocowxqjhjg has clean current public-table grants and RLS, but public table default ACLs owned by supabase_admin still grant anon/authenticated TRUNCATE, TRIGGER, REFERENCES and MAINTAIN in addition to DML. Our postgres connection cannot alter that owner's defaults. Please provide or perform the supported procedure removing those unintended future-object privileges while retaining explicitly authorized public reads and RLS-scoped DML. Do not grant us provider-role membership or change ownership. Please provide the before/after ACLs and a supported future-object verification procedure.

See [Supabase explicit grant/default-privilege guidance](https://supabase.com/docs/guides/api/securing-your-api). Changing postgres-owned defaults alone does not prove this provider-owned entry is corrected. No production probe object or ownership workaround has been created.

### Encrypted database and media recovery

Follow [database backup operations](database-backups.md). Provision the dedicated connection and SSL root, public age recipient, dedicated private Drive folder/permission allowlist, and selected OAuth or Shared Drive service-account settings in the protected GitHub Production environment. Keep the private recovery key outside application/CI. Keep `BACKUP_ENABLED` absent/false until a manual backup, independent download/checksum/decryption and isolated production-sized restore pass. The scheduled run skipped on 2026-10-07 is not a recovery point. Targets remain 24-hour RPO, four-hour RTO and 30-day retention; measure actual timing and perform monthly operator rehearsals.

Fresh read-only recovery inventory:

| Source | Recorded references | Byte-recovery requirement |
| --- | ---: | --- |
| Supabase Storage | 0 buckets / 0 objects | Recheck at each rehearsal; database metadata does not include object bytes |
| Public active Cloudinary media_assets | 1,131 / 363,449,818 recorded bytes | Owner-controlled export of original versions, metadata and transformation requirements; restore into an isolated provider space and compare checksums/counts |
| Google Drive certificate asset links | 404 | Owner-authorized independent file-byte export with private mapping/checksums; verify isolated retrieval and access without changing real sharing |
| Member/admin profile avatar links | 1 member / 2 admin | Include private object recovery through the authorized identity; do not publish URLs or account images |
| Advisor avatars, application photos, form-submission assets, project covers | 0 nonempty references | Recheck; current zero counts are not a permanent absence guarantee |

These source counts may overlap; do not sum them as unique objects. No private file URLs, personal documents or provider secrets were retrieved. Recorded Cloudinary bytes are metadata, not independently verified backup bytes. A live delivery URL is not an offsite recovery copy. Retention may delete only identified backups owned by the workflow, never provider originals or application-export files.

Preserve the ignored execution evidence, worktrees, user-supplied audit and `backup/pre-ai-it-fest-2026`. No cleanup is authorized by a partial acceptance record.
