import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CharacterLimitCounter,
  characterCounterTone,
} from "@/components/admin/character-limit-counter";

describe("character counter thresholds", () => {
  it.each([
    [399, 500, "muted"],
    [400, 500, "warning"],
    [474, 500, "warning"],
    [475, 500, "danger"],
    [799, 1000, "muted"],
    [800, 1000, "warning"],
    [949, 1000, "warning"],
    [950, 1000, "danger"],
  ] as const)("%i of %i is %s", (current, maximum, tone) => {
    expect(characterCounterTone(current, maximum)).toBe(tone);
  });

  it("renders a reusable description target", () => {
    render(<CharacterLimitCounter current={25} id="field-counter" maximum={500} />);

    expect(screen.getByText("25 / 500 characters")).toHaveAttribute("id", "field-counter");
  });
});
