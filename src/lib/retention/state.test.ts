import { describe, expect, it } from "vitest";
import {
  canApproveRetentionPurge,
  canArchiveRetentionJob,
  canPurgeRetentionJob,
  redactEventRegistrantEmail,
  retentionEligibleAt,
} from "./state";

describe("retention state", () => {
  it("uses a calendar three-year retention boundary", () => {
    expect(retentionEligibleAt("2023-07-22T12:00:00.000Z")).toBe(
      "2026-07-22T12:00:00.000Z"
    );
  });

  it("allows archive then explicit approval then purge, never skips stages", () => {
    expect(canArchiveRetentionJob("candidate")).toBe(true);
    expect(canArchiveRetentionJob("purge_approved")).toBe(false);
    expect(canApproveRetentionPurge("archived")).toBe(true);
    expect(canApproveRetentionPurge("candidate")).toBe(false);
    expect(canPurgeRetentionJob("purge_approved")).toBe(true);
    expect(canPurgeRetentionJob("archived")).toBe(false);
  });

  it("replaces an event email with a non-deliverable retained marker", () => {
    expect(redactEventRegistrantEmail("registration-123")).toBe(
      "purged-registration-123@retained.invalid"
    );
  });
});
