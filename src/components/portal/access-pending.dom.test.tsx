import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@/components/auth/logout-button", () => ({ LogoutButton: () => <button>Sign out</button> }));
import PortalAccessPendingPage from "@/app/(auth)/portal/access-pending/page";
it("explains a security restriction without asking an existing member to claim again", async () => {
  render(await PortalAccessPendingPage({ searchParams: Promise.resolve({ access: "frozen" }) }));
  expect(screen.getByRole("heading", { name: /access is restricted/i })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Claim profile" })).toBeNull();
  expect(screen.getByRole("link", { name: "Contact support" })).toBeTruthy();
});
