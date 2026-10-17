import { describe, expect, it, vi } from "vitest";
import { classifyRuns, watchActions } from "./watch-github-actions.mjs";

const sha = "a".repeat(40);
const paths = [".github/workflows/quality-gate.yml", ".github/workflows/diff-check.yml"];
const run = (path, status = "completed", conclusion = "success", id = 1, head_sha = sha) => ({ id, path, status, conclusion, head_sha, run_attempt: 1 });
const options = { sha, requiredPaths: paths };

describe("Actions completion watcher", () => {
  it("never accepts successful checks from a different revision", () => {
    const result = classifyRuns(paths.map(path => run(path, "completed", "success", 1, "b".repeat(40))), options);
    expect(result.state).toBe("waiting");
    expect(result.missing).toEqual(paths);
  });
  it("requires every configured workflow before reporting completion", () => {
    expect(classifyRuns([run(paths[0])], options).state).toBe("waiting");
    expect(classifyRuns(paths.map((path, index) => run(path, "completed", "success", index + 1)), options).state).toBe("complete");
  });
  it("ignores a non-applicable production event before promotion", () => {
    const production = ".github/workflows/production-browser-smoke.yml";
    const runs = [...paths.map(path => run(path)), run(production, "completed", "skipped", 10)];
    expect(classifyRuns(runs, options).state).toBe("complete");
    const requiredProduction = classifyRuns(runs, { ...options, requiredPaths: [...paths, production] });
    expect(requiredProduction.state).toBe("waiting");
    expect(requiredProduction.missing).toEqual([production]);
  });
  it("keeps an actual production smoke failure actionable", () => {
    const production = ".github/workflows/production-browser-smoke.yml";
    expect(classifyRuns([...paths.map(path => run(path)), run(production, "completed", "failure", 10)], options).state).toBe("failed");
  });
  it("uses the latest run rather than an earlier successful attempt", () => {
    const result = classifyRuns([run(paths[0]), run(paths[0], "completed", "failure", 3), run(paths[1], "completed", "success", 2)], options);
    expect(result.state).toBe("failed");
    expect(result.failed.map(item => item.id)).toEqual([3]);
  });
  it("does not hide a newer failed attempt of a lower-ID run", () => {
    const rerun = { ...run(paths[0], "completed", "failure", 99), run_attempt: 2, run_started_at: "2026-10-13T11:00:00Z", updated_at: "2026-10-13T11:01:00Z" };
    const earlierGreen = { ...run(paths[0], "completed", "success", 100), run_started_at: "2026-10-13T10:00:00Z", updated_at: "2026-10-13T10:05:00Z" };
    const result = classifyRuns([rerun, earlierGreen, run(paths[1])], options);
    expect(result.state).toBe("failed");
    expect(result.failed.map(item => item.id)).toEqual([99]);
  });
  it("retains any active required rerun until its attempt completes", () => {
    for (const startedAt of ["2026-10-13T09:00:00Z", "2026-10-13T11:00:00Z"]) {
      const rerun = { ...run(paths[0], "in_progress", null, 99), run_attempt: 2, run_started_at: startedAt };
      const green = { ...run(paths[0], "completed", "success", 100), run_started_at: "2026-10-13T10:00:00Z" };
      const result = classifyRuns([rerun, green, run(paths[1])], options);
      expect(result.state).toBe("waiting");
      expect(result.runs.map(item => item.id)).toContain(99);
    }
  });
  it("does not let a slower older completion hide a newer failing attempt", () => {
    const olderGreen = { ...run(paths[0], "completed", "success", 99), run_started_at: "2026-10-13T09:00:00Z", updated_at: "2026-10-13T12:00:00Z" };
    const newerFailure = { ...run(paths[0], "completed", "failure", 100), run_started_at: "2026-10-13T11:00:00Z", updated_at: "2026-10-13T11:01:00Z" };
    expect(classifyRuns([olderGreen, newerFailure, run(paths[1])], options).state).toBe("failed");
  });
  it("does not call skipped or cancelled required jobs successful", () => {
    for (const conclusion of ["skipped", "cancelled", "neutral", "timed_out", null]) {
      expect(classifyRuns([run(paths[0], "completed", conclusion), run(paths[1])], options).state).toBe("failed");
    }
  });
  it("returns attention for a human approval wait", () => {
    expect(classifyRuns([run(paths[0], "waiting", null), run(paths[1])], options).state).toBe("attention");
  });
  it("waits outside the caller and saves a single terminal report", async () => {
    const read = vi.fn().mockResolvedValueOnce([run(paths[0], "in_progress", null)]).mockResolvedValueOnce(paths.map(path => run(path)));
    const save = vi.fn(); const sleep = vi.fn();
    const result = await watchActions({ ...options, intervalMs: 1000, timeoutMs: 5000 }, { read, save, sleep, now: () => 0 });
    expect(result.state).toBe("complete");
    expect(read).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("ends bounded waits with a timeout report, never a false pass", async () => {
    const read = vi.fn().mockResolvedValue([]); const save = vi.fn();
    let time = 0;
    const result = await watchActions({ ...options, intervalMs: 1000, timeoutMs: 1500 }, { read, save, now: () => time, sleep: async delay => { time += delay; } });
    expect(result.state).toBe("timeout");
    expect(save).toHaveBeenCalledOnce();
  });
  it("reports an API failure without making old green data authoritative", async () => {
    const save = vi.fn();
    const result = await watchActions(options, { read: async () => { throw new Error("sensitive upstream detail"); }, save, now: () => 0 });
    expect(result.state).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("sensitive upstream detail");
    expect(save).toHaveBeenCalledOnce();
  });
});
