import { describe, expect, it } from "vitest";
import { buildCloudinarySrcSet, transformCloudinaryImageUrl, transformCloudinaryUrl } from "./urls";

describe("Cloudinary image recognition", () => {
  it.each([
    "https://example.test/upload/res.cloudinary.com/avatar.png",
    "https://res.cloudinary.com.evil.test/demo/image/upload/avatar.png",
    "https://evilres.cloudinary.com/demo/image/upload/avatar.png",
    "http://res.cloudinary.com/demo/image/upload/avatar.png",
    "https://user@res.cloudinary.com/demo/image/upload/avatar.png",
    "https://res.cloudinary.com:444/demo/image/upload/avatar.png",
    "https://res.cloudinary.com/demo/video/upload/avatar.png",
    "https://example.test/?image=res.cloudinary.com/upload/avatar.png",
    "/upload/local.png",
  ])("preserves non-delivery inputs unchanged: %s", (url) => {
    expect(transformCloudinaryImageUrl(url, "f_auto,q_auto,w_180")).toBe(url);
    expect(transformCloudinaryUrl(url, "blur")).toBe(url);
  });
  it("changes only the delivery path, preserving query, fragment and accounts named upload", () => {
    expect(transformCloudinaryImageUrl(
      "https://res.cloudinary.com/upload/image/upload/v1/a.jpg?next=/upload/res.cloudinary.com#photo",
      "f_auto,q_auto,w_180",
    )).toBe("https://res.cloudinary.com/upload/image/upload/f_auto,q_auto,w_180/v1/a.jpg?next=/upload/res.cloudinary.com#photo");
  });
});

describe("buildCloudinarySrcSet", () => {
  it("builds width-specific candidates for HTTPS Cloudinary images", () => {
    expect(
      buildCloudinarySrcSet(
        "https://res.cloudinary.com/demo/image/upload/v1/home/hero.jpg",
        [640, 960],
      ),
    ).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v1/home/hero.jpg 640w, " +
        "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_960/v1/home/hero.jpg 960w",
    );
  });

  it.each([
    "https://example.test/upload/hero.jpg",
    "http://res.cloudinary.com/demo/image/upload/hero.jpg",
    "https://res.cloudinary.com/demo/video/upload/hero.mp4",
    "not-a-url/upload/hero.jpg",
  ])("does not transform a non-Cloudinary image URL: %s", (url) => {
    expect(buildCloudinarySrcSet(url)).toBeUndefined();
  });
});
