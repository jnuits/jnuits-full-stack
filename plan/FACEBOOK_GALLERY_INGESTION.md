# Facebook Gallery Ingestion Plan

## Goal

Collect verified offline JnUITS activity posts from the official Facebook page, preserve the post descriptions as source metadata, upload event photos/videos to Cloudinary, and expose them later as year-based gallery albums.

Source page: https://www.facebook.com/jnuits

Collection scope:

- Include only offline activities with photos or videos.
- Exclude text-only posts, online-only updates, generic announcements without media, and unrelated shared posts.
- Cover the full operating history from November 2015 through April 2026.

## Current Access Status

The direct unauthenticated fetch path is blocked by Facebook. A probe against `https://mbasic.facebook.com/jnuits` returned the Facebook login shell with canonical login metadata instead of public post/photo content.

Because of that, the importer must use one of these authorized inputs:

- Preferred: a Facebook Page export ZIP from Meta Business/Page settings.
- Preferred: Meta Graph API access using a Page access token with page/post/media read permissions.
- Acceptable for one-time migration: a manually prepared CSV/JSON manifest containing post URLs, dates, descriptions, and downloaded media paths.

Do not use random web-search images or bypass Facebook login/session protections. The migrated gallery needs provenance and should only use official JnUITS-owned or authorized media.

## Local Staging Layout

Ignored local staging root:

```text
artifacts/facebook-jnuits/
```

Year folders are already prepared:

```text
artifacts/facebook-jnuits/2015/raw/
artifacts/facebook-jnuits/2015/optimized/
artifacts/facebook-jnuits/2015/reports/
...
artifacts/facebook-jnuits/2026/raw/
artifacts/facebook-jnuits/2026/optimized/
artifacts/facebook-jnuits/2026/reports/
```

The whole staging root is ignored by Git because it will contain large export files, downloaded media, and migration reports.

## Cloudinary Layout

Cloudinary root:

```text
jnuits/jnuits-full-stack/gallery/
```

Year folders are already prepared:

```text
jnuits/jnuits-full-stack/gallery/2015
jnuits/jnuits-full-stack/gallery/2016
jnuits/jnuits-full-stack/gallery/2017
jnuits/jnuits-full-stack/gallery/2018
jnuits/jnuits-full-stack/gallery/2019
jnuits/jnuits-full-stack/gallery/2020
jnuits/jnuits-full-stack/gallery/2021
jnuits/jnuits-full-stack/gallery/2022
jnuits/jnuits-full-stack/gallery/2023
jnuits/jnuits-full-stack/gallery/2024
jnuits/jnuits-full-stack/gallery/2025
jnuits/jnuits-full-stack/gallery/2026
```

Per-event uploads should use:

```text
jnuits/jnuits-full-stack/gallery/YYYY/MM/event-slug/image-slug
jnuits/jnuits-full-stack/gallery/YYYY/MM/event-slug/video-slug
```

## Metadata Contract

Each imported post should produce a normalized manifest row:

```json
{
  "source": "facebook",
  "sourcePageUrl": "https://www.facebook.com/jnuits",
  "sourcePostUrl": "https://www.facebook.com/jnuits/posts/...",
  "sourcePostId": "optional-facebook-id",
  "activityDate": "YYYY-MM-DD",
  "year": 2025,
  "eventTitle": "Human friendly activity title",
  "eventSlug": "human-friendly-activity-title",
  "postDescription": "Original post text, normalized but not rewritten",
  "offlineActivity": true,
  "activityType": "workshop | seminar | campus-event | competition | orientation | celebration | other",
  "location": "Jagannath University or venue when available",
  "media": [
    {
      "kind": "image",
      "localOriginalPath": "artifacts/facebook-jnuits/YYYY/raw/event-slug/file.jpg",
      "cloudinaryPublicId": "jnuits/jnuits-full-stack/gallery/YYYY/event-slug/file",
      "caption": "Short caption derived from post context",
      "seoTitle": "JnUITS activity title photo",
      "seoAlt": "Students participating in the JnUITS activity title at venue",
      "tags": [
        "jnuits",
        "gallery",
        "facebook-import",
        "offline-activity",
        "year-YYYY",
        "event-slug"
      ]
    }
  ]
}
```

## Cloudinary Upload Rules

Upload originals to Cloudinary and use delivery transformations for website optimization rather than destructive local compression.

Recommended delivery transformations:

- Full image: `f_auto,q_auto,c_limit,w_1600`
- Card image: `f_auto,q_auto,c_fill,w_900,h_600,g_auto`
- Thumbnail: `f_auto,q_auto,c_fill,w_480,h_320,g_auto`
- Video preview: Cloudinary generated poster or `f_auto,q_auto,w_1280`

Upload metadata:

- `asset_folder`: year/event folder.
- `tags`: `jnuits,gallery,facebook-import,offline-activity,year-YYYY,event-slug`.
- `context`: source URL, activity year, event title, caption, SEO alt text, SEO title, and source platform.
- `access_mode`: public for public gallery media.

## Quality And SEO Rules

- Keep original image files unchanged in `raw/`.
- Do not upscale low-resolution source images.
- Use descriptive filenames and public IDs instead of random hashes where practical.
- Generate human-readable `alt` text from event title, venue, people/activity context, and year.
- Keep captions factual and derived from source descriptions.
- Preserve source post URLs for audit/provenance.

## Next Implementation Step

The authorized Meta export has been downloaded and staged locally at:

```text
facebook-jnuits-2026-04-19/
```

Completed ingestion flow:

1. Parsed posts and albums from the Meta export.
2. Filtered real offline activities with media, excluding greetings, birthday wishes, generic announcement cards, and online-only posts.
3. Uploaded selected image assets to Cloudinary under `jnuits/jnuits-full-stack/gallery/YYYY/MM/event-slug`.
4. Added a supplemental exception for the 2018 `অপরাহ্নের আড়িয়াল` tour, because it was stored in Facebook `Mobile uploads` but has valid event metadata and 10 real tour photos.
5. Added a supplemental direct-post pass for real event albums discovered from post captions and media descriptions.
6. Generated the event history catalog for future Events/Gallery development.

Remaining ingestion work:

1. Register selected Cloudinary assets in the app database when the gallery content admin workflow is ready.
2. Decide whether to import historical videos separately.
3. Use `plan/data/jnuits-event-catalog.json` as the seed source for future Events pages.

Supplemental direct-post albums added from post captions:

- `2016/12/bcc-1st-batch`
- `2018/05/executive-committee-iftar-2018`
- `2018/09/executive-committee-planning-meeting-2018`
- `2018/10/typing-master-2018-campaign-day-1`
- `2018/10/typing-master-2018-campaign-day-2`
- `2019/01/member-collection-and-bcc-form-distribution-2019`
- `2019/05/sub-executive-recruitment-exam-2019`
- `2019/11/former-leadership-honorary-crest-moment-2019`
- `2020/03/accelerator-2020-round-1-written-exam`
- `2020/03/accelerator-2020-round-2-group-discussion-assessment`
- `2022/11/applink-telco-application-seminar`
- `2026/02/bcc-season-8-registration-booth-update`

## Current Counts

Current run status:

- Uploaded media files: 1112
- Failed media files: 0
- Prepared event records: 64
- Prepared tour records: 2
- Latest main upload report: `artifacts/facebook-jnuits/reports/facebook-gallery-upload-20260419T163722Z.json`
- Supplemental tour upload report: `artifacts/facebook-jnuits/reports/aparahner-ariyal-tour-upload-20260419T173031Z.json`
- Supplemental direct-post albums report: `artifacts/facebook-jnuits/reports/missing-post-event-albums-upload-20260419T174142Z.json`

By year:

- 2016: 50
- 2017: 21
- 2018: 110
- 2019: 303
- 2020: 136
- 2022: 35
- 2023: 64
- 2024: 85
- 2025: 155
- 2026: 153
