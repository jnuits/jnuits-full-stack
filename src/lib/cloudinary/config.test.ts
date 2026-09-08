import { afterEach, describe, expect, it, vi } from "vitest";

import { isCloudinaryAssetUrl } from "./config";

describe("isCloudinaryAssetUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only HTTPS delivery URLs for the configured Cloudinary account", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "jnuits-cloud");

    expect(
      isCloudinaryAssetUrl(
        "https://res.cloudinary.com/jnuits-cloud/image/upload/v1/avatar.png",
      ),
    ).toBe(true);
    expect(
      isCloudinaryAssetUrl(
        "http://res.cloudinary.com/jnuits-cloud/image/upload/v1/avatar.png",
      ),
    ).toBe(false);
    expect(
      isCloudinaryAssetUrl(
        "https://res.cloudinary.com/another-cloud/image/upload/v1/avatar.png",
      ),
    ).toBe(false);
    expect(
      isCloudinaryAssetUrl(
        "https://evil.res.cloudinary.com/jnuits-cloud/image/upload/v1/avatar.png",
      ),
    ).toBe(false);
  });

  it("accepts supported video URLs only when the expected resource type matches", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "jnuits-cloud");

    const videoUrl =
      "https://res.cloudinary.com/jnuits-cloud/video/upload/v1/intro.mp4";

    expect(isCloudinaryAssetUrl(videoUrl, "video")).toBe(true);
    expect(isCloudinaryAssetUrl(videoUrl, "image")).toBe(false);
    expect(isCloudinaryAssetUrl(videoUrl)).toBe(false);
  });
});
