import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminVerificationReadGate } from "./admin-verification-read-gate";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
describe("protected read shell", () => {
  it("read_gate_hides_sensitive_children until a server refresh authorizes them", () => {
    render(<AdminVerificationReadGate operation="admin.security.read"><p>Private security events</p></AdminVerificationReadGate>);
    expect(screen.queryByText("Private security events")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify account" })).toBeEnabled();
  });
});
