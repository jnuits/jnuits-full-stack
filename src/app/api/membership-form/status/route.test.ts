import { describe, expect, it } from "vitest";
import { getAntiEnumerationDelayMs } from "./route";

describe("membership status timing helpers", () => {
  it("keeps the jittered delay inside a small fixed range", () => {
    expect(getAntiEnumerationDelayMs(0)).toBe(80);
    expect(getAntiEnumerationDelayMs(0.5)).toBe(140);
    expect(getAntiEnumerationDelayMs(0.999)).toBe(199);
  });
});
