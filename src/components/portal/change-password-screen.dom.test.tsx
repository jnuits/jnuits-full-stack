import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requirePortalIdentity: mocks.identity }));
vi.mock("@/lib/portal/member", () => ({ getPortalMemberSnapshot: mocks.snapshot }));
vi.mock("@/lib/security/captcha", () => ({ getAuthCaptchaUiConfig: () => ({ required: false, siteKey: "" }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/portal/profile/change-password" }));
vi.mock("next/link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
vi.mock("@/components/auth/logout-button", () => ({ LogoutButton: () => <button>Sign out</button> }));
vi.mock("@/components/theme/theme-toggle", () => ({ ThemeToggle: () => <button>Theme</button> }));
import { ChangePasswordScreen } from "./change-password-screen";
beforeEach(() => {
  mocks.identity.mockResolvedValue({ user: { id: "owner", email: "fictional@example.test", portalRole: "member" } });
  mocks.snapshot.mockResolvedValue({ member: null, membership: { fullName: "Fictional Former Member", jnuitsId: "JNUITS-2024001", avatarSecureUrl: null }, access: { mode: "restricted" } });
});
it("lets former members change their password without offering normal profile edits", async () => {
  render(await ChangePasswordScreen());
  expect(screen.getByRole("link", { name: "Membership" })).toHaveAttribute("href", "/portal/membership");
  expect(screen.getByLabelText("Current password")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Edit Profile" })).not.toBeInTheDocument();
});
it("retains advisor navigation on the password page without a member record", async () => {
  mocks.identity.mockResolvedValue({ user: { id: "owner", portalRole: "advisor" } });
  mocks.snapshot.mockResolvedValue({ member: null, membership: null, access: { mode: "blocked" } });
  render(await ChangePasswordScreen());
  expect(screen.getByRole("link", { name: "Advisor Profile" })).toHaveAttribute("href", "/portal/advisor/profile");
});
