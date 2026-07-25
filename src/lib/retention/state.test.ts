import { describe, expect, it } from "vitest";
import {
  canApproveRetentionPurge,
  canArchiveRetentionJob,
  canPurgeRetentionJob,
  isRetentionEligible,
  redactEventRegistrantEmail,
  retentionBoundaryAt,
  retentionEligibleAt,
} from "./state";

describe("retention state", () => {
  it("uses an exact calendar three-year retention boundary", () => {
    expect(retentionEligibleAt("2023-07-22T12:00:00.000Z")).toBe("2026-07-22T12:00:00.000Z");
    expect(isRetentionEligible("2023-07-22T12:00:00.000Z", new Date("2026-07-22T11:59:59.999Z"))).toBe(false);
    expect(isRetentionEligible("2023-07-22T12:00:00.000Z", new Date("2026-07-22T12:00:00.000Z"))).toBe(true);
    expect(isRetentionEligible("2023-07-22T12:00:00.000Z", new Date("2026-07-22T12:00:00.001Z"))).toBe(true);
  });

  it("derives the row-selection cutoff three calendar years back", () => {
    expect(retentionBoundaryAt(new Date("2026-07-26T00:00:00.000Z"))).toBe("2023-07-26T00:00:00.000Z");
    expect(retentionBoundaryAt(new Date("2026-02-28T09:30:00.000Z"))).toBe("2023-02-28T09:30:00.000Z");
  });

  it("keeps the boundary and the eligibility check in agreement", () => {
    const now = new Date("2026-07-26T00:00:00.000Z");
    const boundary = retentionBoundaryAt(now);
    expect(isRetentionEligible(boundary, now)).toBe(true);
    expect(isRetentionEligible(new Date(new Date(boundary).getTime() + 1).toISOString(), now)).toBe(false);
  });

  it("rejects invalid timestamps rather than guessing a boundary", () => {
    expect(() => retentionEligibleAt("not-a-date")).toThrow("invalid timestamp");
    expect(() => isRetentionEligible("not-a-date")).toThrow("invalid timestamp");
    expect(() => retentionBoundaryAt(new Date("not-a-date"))).toThrow("comparison time is invalid");
  });

  it("allows archive then explicit approval then purge, never skips stages", () => {
    expect(canArchiveRetentionJob("candidate")).toBe(true);
    expect(canArchiveRetentionJob("failed")).toBe(true);
    expect(canArchiveRetentionJob("archived")).toBe(false);
    expect(canApproveRetentionPurge("candidate")).toBe(false);
    expect(canApproveRetentionPurge("archived")).toBe(true);
    expect(canPurgeRetentionJob("archived")).toBe(false);
    expect(canPurgeRetentionJob("purge_approved")).toBe(true);
  });

  it("replaces an event email with a non-deliverable retained marker", () => {
    expect(redactEventRegistrantEmail("registration-123")).toBe("purged-registration-123@retained.invalid");
  });
});
