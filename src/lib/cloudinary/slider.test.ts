import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOUDINARY_SLIDER_FOLDER } from "@/lib/branding";
import { ensureSliderImageInDefaultFolder, isSliderCloudinaryUrl } from "./slider";

const own = `https://res.cloudinary.com/jnuits-cloud/image/upload/v123/${CLOUDINARY_SLIDER_FOLDER}/hero.jpg`;

describe("slider asset reuse", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "jnuits-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "secret");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("reuses only this project's slider public IDs without another upload", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(isSliderCloudinaryUrl(own)).toBe(true);
    expect(isSliderCloudinaryUrl(own.replace("/v123/", "/f_auto,q_auto/"))).toBe(true);
    await expect(ensureSliderImageInDefaultFolder(own, "hero")).resolves.toEqual({ publicId: "", url: own });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    own.replace("jnuits-cloud", "other-cloud"),
    own.replace("https:", "http:"),
    own.replace("res.cloudinary.com", "evilres.cloudinary.com"),
    own.replace("res.cloudinary.com", "user@res.cloudinary.com"),
    own.replace("res.cloudinary.com", "res.cloudinary.com:444"),
    own.replace("/image/upload/", "/video/upload/"),
    own.replace("/image/upload/", "/image/authenticated/"),
    own.replace(`/v123/${CLOUDINARY_SLIDER_FOLDER}/`, `/v123/other/${CLOUDINARY_SLIDER_FOLDER}/`),
    own.replace("/slider/", "/slider-other/"),
    own.replace("/slider/", "/slider%2f"),
    own.replace("/slider/", "/slider//"),
    own.replace("hero.jpg", "%ZZ.jpg"),
  ])("does not trust another URL as an owned slider asset: %s", (url) => {
    expect(isSliderCloudinaryUrl(url)).toBe(false);
  });
  it("still imports an ordinary external image through the signed upload path", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ public_id: "copied", secure_url: own }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(ensureSliderImageInDefaultFolder("https://example.test/photo.jpg", "photo")).resolves.toMatchObject({ url: own });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.cloudinary.com/v1_1/jnuits-cloud/image/upload");
    expect(init.body.get("file")).toBe("https://example.test/photo.jpg");
    expect(init.body.get("signature")).toMatch(/^[a-f0-9]{64}$/);
  });
});
