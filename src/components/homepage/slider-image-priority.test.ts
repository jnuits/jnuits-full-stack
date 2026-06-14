import { describe, expect, it } from "vitest";
import { getHomepageSlideImagePriority } from "@/components/homepage/slider-image-priority";

describe("getHomepageSlideImagePriority", () => {
  it("marks exactly the active slide as eager/high", () => {
    const priorities = [0, 1, 2, 3].map((index) =>
      getHomepageSlideImagePriority(index, 2)
    );

    expect(priorities).toEqual([
      { fetchPriority: "auto", loading: "lazy" },
      { fetchPriority: "auto", loading: "lazy" },
      { fetchPriority: "high", loading: "eager" },
      { fetchPriority: "auto", loading: "lazy" },
    ]);
    expect(priorities.filter((priority) => priority.loading === "eager")).toHaveLength(1);
    expect(priorities.filter((priority) => priority.fetchPriority === "high")).toHaveLength(1);
  });
});
