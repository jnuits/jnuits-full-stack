import { describe, expect, it } from "vitest";

import {
  AI_IT_FEST_2026_EVENTS,
  AI_IT_FEST_2026_MEDIA,
} from "./data/ai-it-fest-2026-events.mjs";

import {
  buildEventRows,
  findContentConflicts,
  findMediaConflicts,
  findStoredEventMismatches,
  validateBrainchildSourceHtml,
  validateOfficialApiSnapshot,
} from "./import-ai-it-fest-2026-events.mjs";

const EVENT_SLUGS = [
  "jnu-ai-it-fest-2026",
  "ai-it-olympiad",
  "techuncut",
  "techcare-zone",
  "ai-ad-venture",
  "brainchild-season-2-0",
];

describe("AI and IT Fest 2026 manifest", () => {
  it("defines six uniquely addressable canonical events in campaign order", () => {
    expect(AI_IT_FEST_2026_EVENTS.map((event) => event.slug)).toEqual(
      EVENT_SLUGS
    );
    expect(new Set(AI_IT_FEST_2026_EVENTS.map((event) => event.title))).toHaveProperty(
      "size",
      6
    );
    expect(AI_IT_FEST_2026_MEDIA).toHaveLength(6);
    expect(new Set(AI_IT_FEST_2026_MEDIA.map((asset) => asset.publicId))).toHaveProperty(
      "size",
      6
    );
  });

  it("keeps all source images inside the task-owned Cloudinary folder", () => {
    for (const asset of AI_IT_FEST_2026_MEDIA) {
      expect(asset.publicId).toMatch(
        /^jnuits\/jnuits-full-stack\/campaigns\/ai-it-fest-2026\//
      );
      expect(asset.sourceUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
      expect(asset.metadata.campaignId).toBe("jnu-ai-it-fest-2026");
    }
  });

  it("preserves the shared authoritative schedule without inventing end times", () => {
    for (const event of AI_IT_FEST_2026_EVENTS) {
      expect(event.startsAt).toBe("2026-08-30T03:00:00Z");
      expect(event.endsAt).toBeNull();
      expect(event.timezone).toBe("Asia/Dhaka");
    }
  });

  it("stores minute-precision API deadlines exactly for the four standard segments", () => {
    const standardEvents = AI_IT_FEST_2026_EVENTS.filter((event) =>
      [
        "ai-it-olympiad",
        "techuncut",
        "techcare-zone",
        "ai-ad-venture",
      ].includes(event.slug)
    );

    expect(standardEvents).toHaveLength(4);
    for (const event of standardEvents) {
      expect(event.registrationClosesAt).toBe("2026-08-15T17:59:00Z");
      expect(event.source).toBe("https://festapi.jnuits.org.bd/api/events");
      expect(event.sourceMetadata.deadlineSourceValue).toBe(
        "2026-08-15T23:59"
      );
      expect(event.sourceMetadata.deadlinePrecision).toBe("minute");
      expect(event.sourceMetadata.officialApiId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f-]{27}$/
      );
    }
  });

  it("uses the dedicated BrainChild source and its explicit second precision", () => {
    const brainchild = AI_IT_FEST_2026_EVENTS.find(
      (event) => event.slug === "brainchild-season-2-0"
    );

    expect(brainchild).toMatchObject({
      registrationClosesAt: "2026-08-20T17:59:59Z",
      registrationMode: "external",
      registrationUrl: "https://brainchild.jnuits.org.bd/register",
      source: "https://brainchild.jnuits.org.bd/",
    });
    expect(brainchild.sourceMetadata).toMatchObject({
      deadlinePrecision: "second",
      deadlineSourceValue: "2026-08-20T23:59:59+06:00",
      officialApiSlug: "brainchild-season-20",
      secondaryDeadlineSourceValue: "2026-08-15T23:59",
    });
  });

  it("uses external registration for five segments and no umbrella registration", () => {
    expect(
      AI_IT_FEST_2026_EVENTS.filter(
        (event) => event.registrationMode === "external"
      )
    ).toHaveLength(5);
    expect(AI_IT_FEST_2026_EVENTS[0]).toMatchObject({
      ctaUrl: "https://itfest.jnuits.org.bd/events",
      registrationClosesAt: null,
      registrationMode: "none",
      registrationUrl: null,
    });
  });
});

describe("AI and IT Fest 2026 content operator", () => {
  const assetIds = new Map(
    AI_IT_FEST_2026_MEDIA.map((asset, index) => [asset.key, `media-${index + 1}`])
  );

  it("accepts the official API values encoded by the manifest", () => {
    const data = AI_IT_FEST_2026_EVENTS.slice(1).map((event) => ({
      coverImage: AI_IT_FEST_2026_MEDIA.find(
        (asset) => asset.key === event.mediaKey
      ).sourceUrl,
      deadline:
        event.slug === "brainchild-season-2-0"
          ? event.sourceMetadata.secondaryDeadlineSourceValue
          : event.sourceMetadata.deadlineSourceValue,
      eventDate: event.sourceMetadata.sourceEventDateValue,
      id: event.sourceMetadata.officialApiId,
      slug: event.sourceMetadata.officialApiSlug,
    }));

    expect(validateOfficialApiSnapshot({ data, success: true })).toEqual([]);
  });

  it("detects a changed minute-precision deadline before an apply run", () => {
    const data = AI_IT_FEST_2026_EVENTS.slice(1).map((event) => ({
      coverImage: AI_IT_FEST_2026_MEDIA.find(
        (asset) => asset.key === event.mediaKey
      ).sourceUrl,
      deadline:
        event.slug === "techuncut"
          ? "2026-08-15T23:59:59"
          : event.slug === "brainchild-season-2-0"
            ? event.sourceMetadata.secondaryDeadlineSourceValue
            : event.sourceMetadata.deadlineSourceValue,
      eventDate: event.sourceMetadata.sourceEventDateValue,
      id: event.sourceMetadata.officialApiId,
      slug: event.sourceMetadata.officialApiSlug,
    }));

    expect(validateOfficialApiSnapshot({ data, success: true })).toContain(
      'Official API deadline changed for "techuncut": expected "2026-08-15T23:59", received "2026-08-15T23:59:59".'
    );
  });

  it("requires the dedicated BrainChild source to retain its exact structured deadline", () => {
    expect(
      validateBrainchildSourceHtml(
        '<script type="application/ld+json">{"offers":{"validThrough":"2026-08-20T23:59:59+06:00"}}</script>'
      )
    ).toEqual([]);
    expect(
      validateBrainchildSourceHtml(
        '<script type="application/ld+json">{"offers":{"validThrough":"2026-08-20T23:59:00+06:00"}}</script>'
      )
    ).toEqual([
      'Dedicated BrainChild source no longer contains "2026-08-20T23:59:59+06:00".',
    ]);
  });

  it("builds complete draft rows with canonical provenance and cover IDs", () => {
    const rows = buildEventRows(assetIds, "draft");
    const brainchild = rows.find(
      (row) => row.slug === "brainchild-season-2-0"
    );

    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.status === "draft")).toBe(true);
    expect(rows.every((row) => row.published_at === null)).toBe(true);
    expect(rows.map((row) => row.cover_media_asset_id)).toEqual([
      "media-1",
      "media-2",
      "media-3",
      "media-4",
      "media-5",
      "media-6",
    ]);
    expect(brainchild).toMatchObject({
      registration_closes_at: "2026-08-20T17:59:59Z",
      registration_url: "https://brainchild.jnuits.org.bd/register",
      source: "https://brainchild.jnuits.org.bd/",
      source_metadata: {
        campaignId: "jnu-ai-it-fest-2026",
        officialApiSlug: "brainchild-season-20",
      },
    });
  });

  it("detects any deadline drift when production rows are read back", () => {
    const expectedRows = buildEventRows(assetIds, "draft");
    const storedRows = expectedRows.map((row, index) => ({
      ...row,
      id: `event-${index + 1}`,
    }));

    expect(findStoredEventMismatches(storedRows, expectedRows)).toEqual([]);

    storedRows[2] = {
      ...storedRows[2],
      registration_closes_at: "2026-08-15T17:59:59Z",
    };

    expect(findStoredEventMismatches(storedRows, expectedRows)).toContain(
      'Stored event "techuncut" has registration_closes_at "2026-08-15T17:59:59Z"; expected "2026-08-15T17:59:00Z".'
    );
  });
  it("refuses to build rows when any official cover is unresolved", () => {
    const incompleteAssetIds = new Map(assetIds);
    incompleteAssetIds.delete("techuncut");

    expect(() => buildEventRows(incompleteAssetIds, "draft")).toThrow(
      'Missing media asset ID for "techuncut".'
    );
  });

  it("rejects unrelated event slug and title collisions", () => {
    const conflicts = findContentConflicts([
      {
        id: "unrelated-slug",
        slug: "techuncut",
        source_metadata: { campaignId: "another-campaign" },
        title: "Different title",
      },
      {
        id: "unrelated-title",
        slug: "different-slug",
        source_metadata: {},
        title: "BrainChild Season 2.0",
      },
    ]);

    expect(conflicts).toEqual([
      expect.objectContaining({ id: "unrelated-slug", reason: "slug" }),
      expect.objectContaining({ id: "unrelated-title", reason: "title" }),
    ]);
  });

  it("allows exact task-owned event rows to be resumed", () => {
    expect(
      findContentConflicts([
        {
          id: "owned-event",
          slug: "techuncut",
          source_metadata: { campaignId: "jnu-ai-it-fest-2026" },
          title: "TechUncut",
        },
      ])
    ).toEqual([]);
  });

  it("rejects a task public ID owned by unrelated media", () => {
    expect(
      findMediaConflicts([
        {
          id: "foreign-media",
          metadata: { campaignId: "another-campaign" },
          public_id:
            "jnuits/jnuits-full-stack/campaigns/ai-it-fest-2026/techuncut",
        },
      ])
    ).toEqual([
      expect.objectContaining({ id: "foreign-media", reason: "public_id" }),
    ]);
  });
});