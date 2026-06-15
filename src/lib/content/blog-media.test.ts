import { describe, expect, it } from "vitest";
import {
  BLOG_COVER_UPLOAD_FOLDER,
  isValidBlogCoverUploadFile,
  mapRegisteredBlogMediaOption,
} from "@/lib/content/blog-media";

describe("blog media helpers", () => {
  it("uses the Cloudinary blog cover folder", () => {
    expect(BLOG_COVER_UPLOAD_FOLDER).toBe("jnuits/jnuits-full-stack/blogs");
  });

  it("accepts only non-empty image files for blog cover upload", () => {
    expect(isValidBlogCoverUploadFile({ size: 1024, type: "image/png" })).toBe(true);
    expect(isValidBlogCoverUploadFile({ size: 0, type: "image/png" })).toBe(false);
    expect(isValidBlogCoverUploadFile({ size: 1024, type: "video/mp4" })).toBe(false);
  });

  it("maps registered Cloudinary metadata into a selectable blog media option", () => {
    expect(
      mapRegisteredBlogMediaOption({
        altText: "Fallback alt",
        fallbackTitle: "Fallback title",
        publicId: "jnuits/blogs/cover",
        registered: {
          altText: "Registered alt",
          id: "asset-id",
          mediaKind: "image",
          publicId: "jnuits/blogs/registered",
          secureUrl: "https://res.cloudinary.com/demo/image/upload/cover.jpg",
          thumbnailUrl: "https://res.cloudinary.com/demo/image/upload/thumb.jpg",
          title: "Registered title",
        },
        secureUrl: "https://res.cloudinary.com/demo/image/upload/fallback.jpg",
      })
    ).toEqual({
      alt_text: "Registered alt",
      id: "asset-id",
      media_kind: "image",
      public_id: "jnuits/blogs/registered",
      secure_url: "https://res.cloudinary.com/demo/image/upload/cover.jpg",
      thumbnail_url: "https://res.cloudinary.com/demo/image/upload/thumb.jpg",
      title: "Registered title",
    });
  });
});
