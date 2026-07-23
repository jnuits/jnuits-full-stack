import { describe, expect, it } from "vitest";
import {
  availableFormLifecycleActions,
  formLifecycleActionLabel,
} from "./lifecycle-actions";

describe("form lifecycle operator actions", () => {
  it("allows published forms to close or archive", () => {
    expect(availableFormLifecycleActions("published", true)).toEqual([
      "closed",
      "archived",
    ]);
  });

  it("allows only a closed form with a published snapshot to reopen", () => {
    expect(availableFormLifecycleActions("closed", true)).toEqual([
      "published",
      "archived",
    ]);
    expect(availableFormLifecycleActions("closed", false)).toEqual(["archived"]);
  });

  it("keeps archived forms terminal", () => {
    expect(availableFormLifecycleActions("archived", true)).toEqual([]);
  });

  it("uses operator-facing lifecycle copy", () => {
    expect(formLifecycleActionLabel("closed")).toBe("Close intake");
    expect(formLifecycleActionLabel("published")).toBe("Reopen intake");
    expect(formLifecycleActionLabel("archived")).toBe("Archive form");
  });
});
