import { describe, expect, it } from "vitest";
import { buildCloudinarySrcSet } from "./urls";

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
