import { afterEach, describe, expect, it, vi } from "vitest";

import { getCloudinaryImageResource } from "./admin";

describe("getCloudinaryImageResource", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("loads trusted metadata from the authenticated Admin API", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "jnuits-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "api-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "api-secret");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          bytes: 1200,
          format: "webp",
          height: 400,
          public_id: "jnuits/member-avatars/user/avatar",
          resource_type: "image",
          secure_url:
            "https://res.cloudinary.com/jnuits-cloud/image/upload/v1/avatar.webp",
          type: "upload",
          width: 400,
        }),
        { status: 200 },
      ),
    );

    await expect(
      getCloudinaryImageResource("jnuits/member-avatars/user/avatar"),
    ).resolves.toMatchObject({
      bytes: 1200,
      format: "webp",
      publicId: "jnuits/member-avatars/user/avatar",
      width: 400,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudinary.com/v1_1/jnuits-cloud/resources/image/upload/jnuits%2Fmember-avatars%2Fuser%2Favatar",
      expect.objectContaining({
        cache: "no-store",
        headers: {
          Authorization: `Basic ${Buffer.from("api-key:api-secret").toString("base64")}`,
        },
      }),
    );
  });

  it("fails closed when Cloudinary returns incomplete metadata", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "jnuits-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "api-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "api-secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ public_id: "avatar" }), { status: 200 }),
    );

    await expect(getCloudinaryImageResource("avatar")).rejects.toThrow(
      "incomplete metadata",
    );
  });
});
