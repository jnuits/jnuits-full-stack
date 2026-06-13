import { describe, expect, it } from "vitest";
import { runBoundedTasks } from "@/lib/async/bounded-concurrency";

describe("runBoundedTasks", () => {
  it("limits active task concurrency and preserves partial failures", async () => {
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 6 }, (_, index) => async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);

      await new Promise<void>((resolve) => setTimeout(resolve, 1));

      active -= 1;

      if (index === 4) {
        throw new Error("failed");
      }

      return index;
    });
    const results = await runBoundedTasks(tasks, 3);

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(results.filter((result) => result.ok)).toHaveLength(5);
    expect(results[4]).toMatchObject({ index: 4, ok: false });
  });
});
