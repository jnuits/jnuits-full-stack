import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
const mocks = vi.hoisted(() => ({ snapshot: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requirePortalUser: async () => ({ user: { id: "owner", portalRole: "member" } }) }));
vi.mock("@/lib/portal/member", () => ({ getPortalMemberSnapshot: mocks.snapshot }));
vi.mock("@/lib/content/projects", () => ({ getMemberProjects: async () => [] }));
vi.mock("@/app/(portal)/portal/profile/actions", () => ({ requestAlumniConversionAction: vi.fn(), requestProfileDeletionAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/portal" }));
vi.mock("next/link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
vi.mock("@/components/auth/logout-button", () => ({ LogoutButton: () => <button>Sign out</button> }));
vi.mock("@/components/theme/theme-toggle", () => ({ ThemeToggle: () => <button>Theme</button> }));
import { PortalOverviewScreen } from "./portal-overview-screen";
beforeEach(() => {
  mocks.snapshot.mockResolvedValue({ member: { id: "member", full_name: "Fictional Current Member", jnuits_id: "JNUITS-2024001", member_type: "current" }, membership: { renewalState: "grace", renewalDueOn: "2025-07-01", graceEndsOn: "2026-01-01" }, access: { mode: "mutable", canMutate: true, isRestricted: false, portalAccessStatus: "active" }, timeline: [], workplaceRequests: [], accountRequests: [], directoryVerified: false });
});
it("shows the overdue grace warning on the normal current dashboard and links to renewal", async () => {
  render(await PortalOverviewScreen());
  expect(screen.getByRole("status")).toHaveTextContent("Renewal overdue — grace period");
  expect(screen.getByRole("status")).toHaveTextContent("continue using your member portal");
  expect(screen.getByRole("link", { name: "Manage renewal" })).toHaveAttribute("href", "/portal/membership");
  expect(screen.getAllByRole("link", { name: "Edit Profile" }).length).toBeGreaterThan(0);
});
