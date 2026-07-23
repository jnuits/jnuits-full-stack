import { describe, expect, it } from "vitest";
import { moveItem } from "./field-order";

describe("Form Studio field ordering", () => {
  it("moves fields without mutating the source", () => {
    const source = ["name", "email", "consent"];
    expect(moveItem(source, 2, 1)).toEqual(["name", "consent", "email"]);
    expect(source).toEqual(["name", "email", "consent"]);
  });

  it("ignores invalid moves", () => {
    expect(moveItem(["name"], 0, 2)).toEqual(["name"]);
  });
});
