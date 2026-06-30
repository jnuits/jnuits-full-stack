import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const galleryMocks = vi.hoisted(() => ({
  getGalleryAlbumItemsPage: vi.fn(),
}));

vi.mock("@/lib/content/gallery", () => ({
  getGalleryAlbumItemsPage: galleryMocks.getGalleryAlbumItemsPage,
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ slug: "freshers-2026" }) };

function request(path: string) {
  return new NextRequest(`https://jnuits.org.bd${path}`, { method: "GET" });
}

describe("gallery album items route", () => {
  it("rejects malformed limits before querying", async () => {
    galleryMocks.getGalleryAlbumItemsPage.mockReset();

    const response = await GET(
      request("/api/gallery/albums/freshers-2026/items?limit=9999"),
      context
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "Provide a valid gallery pagination request.",
    });
    expect(galleryMocks.getGalleryAlbumItemsPage).not.toHaveBeenCalled();
  });

  it("passes a clamped valid request to the paginated loader", async () => {
    galleryMocks.getGalleryAlbumItemsPage.mockResolvedValueOnce({ items: [], nextCursor: null });

    const response = await GET(
      request("/api/gallery/albums/freshers-2026/items?limit=40&cursor=abc"),
      context
    );

    expect(response.status).toBe(200);
    expect(galleryMocks.getGalleryAlbumItemsPage).toHaveBeenCalledWith({
      cursor: "abc",
      limit: 40,
      slug: "freshers-2026",
    });
  });
});