import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminReadOperation } from "./types";

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), refresh: vi.fn() }));
// The external server action owns Auth/cookie mutation; keep the rendered
// notice and the actual LogoutButton real to exercise the recovery control.
vi.mock("@/app/(auth)/actions", () => ({ performSignOut: mocks.signOut }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
import { adminReadVerificationNotice } from "./read-boundary";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue(undefined);
});

describe("protected-read session recovery", () => {
  it.each([
    ["admin.security.read", "session_invalid"],
    ["admin.security.read", "role_version_stale"],
    ["admin.system_health.read", "session_invalid"],
    ["admin.system_health.read", "role_version_stale"],
    ["admin.retention.read", "session_invalid"],
    ["admin.retention.read", "role_version_stale"],
  ] satisfies [AdminReadOperation, string][])("offers a fresh admin sign-in for %s / %s, not an unusable challenge", async (operation, code) => {
    render(adminReadVerificationNotice(operation, code));
    expect(screen.getByRole("heading", { name: "Sign in again" })).toBeInTheDocument();
    expect(screen.getByText(/log out and sign in again/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify account" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith("/admin/login"));
  });

  it("still offers verification, not sign-out, for a valid session needing assurance", () => {
    render(adminReadVerificationNotice("admin.security.read", "verification_required"));
    expect(screen.getByRole("button", { name: "Verify account" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
  });

  it.each(["permission_denied", "verification_unavailable"])("does not offer an authorization bypass for %s", code => {
    render(adminReadVerificationNotice("admin.security.read", code));
    expect(screen.queryByRole("button", { name: "Verify account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
    expect(screen.getByText(/protected information is hidden/i)).toBeInTheDocument();
  });
});
