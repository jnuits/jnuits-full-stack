import { afterEach, describe, expect, it, vi } from "vitest";

import { createCloudinarySignature, isCloudinaryAssetUrl } from "./config";

describe("Cloudinary request signature protocol", () => {
  it("uses SHA-256 with sorted, non-empty parameters and unchanged false/zero values", () => {
    expect(createCloudinarySignature({ timestamp: 1315060510 }, "abcd"))
      .toBe("5652e549a70bdc03f73a633a23b7d3f3b067d72fff26dd15b25997f46fdf6439");
    expect(createCloudinarySignature({ z: "", unused: null, missing: undefined, timestamp: 0, overwrite: false }, "abcd"))
      .toBe(createCloudinarySignature({ overwrite: false, timestamp: 0 }, "abcd"));
  });
});

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
