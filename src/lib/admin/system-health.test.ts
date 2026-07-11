import { describe, expect, it } from "vitest";
import {
  buildMigrationParityReviewCheck,
  buildMigrationRuntimeReadinessCheck,
  type SystemHealthCheck,
} from "@/lib/admin/system-health";

function runtimeCheck(label: string, status: SystemHealthCheck["status"]): SystemHealthCheck {
  return {
    detail: "test",
    group: "Database",
    label,
    source: "runtime",
    status,
  };
}

describe("system-health migration checks", () => {
  const criticalLabels = [
    "Public certificate safe view",
    "Gallery album card view",
    "Rate-limit table",
    "Admin invitation metadata",
    "Server-only Auth lookup",
  ];

  it("reports runtime readiness only when every required object is reachable", () => {
    const ready = buildMigrationRuntimeReadinessCheck(
      criticalLabels.map((label) => runtimeCheck(label, "ok"))
    );
    const missing = buildMigrationRuntimeReadinessCheck(
      criticalLabels.slice(0, -1).map((label) => runtimeCheck(label, "ok"))
    );

    expect(ready.status).toBe("ok");
    expect(missing.status).toBe("fail");
  });

  it("keeps migration parity as an explicit review warning", () => {
    const check = buildMigrationParityReviewCheck();

    expect(check.status).toBe("warn");
    expect(check.source).toBe("review");
    expect(check.detail).toContain("migration:check");
  });
});