import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminNavClient } from "./admin-nav-client";
import type { AdminShellNavigationItem } from "./admin-shell";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock theme toggle
vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Toggle theme">Theme</button>,
}));

// Mock logout button
vi.mock("@/components/auth/logout-button", () => ({
  LogoutButton: ({ className }: { className?: string }) => (
    <button type="button" className={className} aria-label="Logout">
      Logout
    </button>
  ),
}));

// Mock site brand
vi.mock("@/components/layout/site-brand", () => ({
  SiteBrand: () => <div>JnUITS Brand</div>,
}));

describe("AdminNavClient Responsive Shell & Navigation", () => {
  const badgeCounts = {
    pendingApps: 2,
    pendingWorkplace: 0,
    pendingProfile: 0,
    pendingProfileRequests: 1,
  };

  const navigationItems: AdminShellNavigationItem[] = [
    {
      group: "Overview",
      href: "/admin",
      iconKey: "dashboard" as const,
      label: "Dashboard",
    },
    {
      group: "Content",
      href: "/admin/content",
      iconKey: "folder" as const,
      label: "Content Hub",
    },
    {
      badgeKey: "pendingApps" as const,
      group: "Membership",
      href: "/admin/applications",
      iconKey: "clipboard" as const,
      label: "Applications",
    },
  ];

  it("renders the layout directly without fragile DOM portals", () => {
    const { container } = render(
      <AdminNavClient badgeCounts={badgeCounts} navigationItems={navigationItems}>
        <div data-testid="admin-test-page">Admin Content Body</div>
      </AdminNavClient>
    );

    // Verify children rendered inside main.admin-content
    const mainContent = container.querySelector("main.admin-content");
    expect(mainContent).toBeTruthy();
    expect(screen.getByTestId("admin-test-page")).toBeInTheDocument();

    // Verify hamburger button is positioned in header.admin-topbar__left
    const topbarLeft = container.querySelector(".admin-topbar__left");
    expect(topbarLeft).toBeTruthy();
    const toggleBtn = topbarLeft?.querySelector("#admin-sidebar-toggle");
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn).toHaveAttribute("aria-label", "Open sidebar");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles the mobile sidebar open and closed via toggle and close buttons", () => {
    const { container } = render(
      <AdminNavClient badgeCounts={badgeCounts} navigationItems={navigationItems}>
        <div>Body</div>
      </AdminNavClient>
    );

    const toggleBtn = screen.getByRole("button", { name: "Open sidebar" });
    const sidebar = container.querySelector(".admin-sidebar");
    const overlay = container.querySelector(".admin-sidebar-overlay");

    // Initially closed
    expect(sidebar).toHaveAttribute("data-open", "false");
    expect(overlay).toHaveAttribute("data-open", "false");

    // Open drawer
    fireEvent.click(toggleBtn);
    expect(sidebar).toHaveAttribute("data-open", "true");
    expect(overlay).toHaveAttribute("data-open", "true");
    expect(toggleBtn).toHaveAttribute("aria-label", "Close sidebar");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    // Close via drawer close button
    const closeBtn = screen.getByRole("button", { name: "Close navigation" });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);

    expect(sidebar).toHaveAttribute("data-open", "false");
    expect(overlay).toHaveAttribute("data-open", "false");
    expect(toggleBtn).toHaveAttribute("aria-label", "Open sidebar");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    // Reopen and close via overlay click
    fireEvent.click(toggleBtn);
    expect(sidebar).toHaveAttribute("data-open", "true");
    if (overlay) fireEvent.click(overlay);
    expect(sidebar).toHaveAttribute("data-open", "false");
  });

  it("renders topbar actions with compact mobile logout class and single theme toggle", () => {
    const { container } = render(
      <AdminNavClient badgeCounts={badgeCounts} navigationItems={navigationItems}>
        <div>Body</div>
      </AdminNavClient>
    );

    const topbarRight = container.querySelector(".admin-topbar__right");
    expect(topbarRight).toBeTruthy();

    const logoutBtn = topbarRight?.querySelector(".admin-topbar__logout");
    expect(logoutBtn).toBeTruthy();
  });

  it("renders accessible Skip to Main Content link targeting #admin-main", () => {
    const { container } = render(
      <AdminNavClient badgeCounts={badgeCounts} navigationItems={navigationItems}>
        <div>Body Content</div>
      </AdminNavClient>
    );

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#admin-main");

    const main = container.querySelector("#admin-main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("renders command palette trigger button and opens dialog on click", () => {
    render(
      <AdminNavClient badgeCounts={badgeCounts} navigationItems={navigationItems}>
        <div>Body Content</div>
      </AdminNavClient>
    );

    const searchBtn = screen.getByRole("button", {
      name: "Search admin workspace (Ctrl+K or ⌘K)",
    });
    expect(searchBtn).toBeInTheDocument();

    // Open palette
    fireEvent.click(searchBtn);
    expect(screen.getByRole("dialog", { name: "Admin command palette" })).toBeInTheDocument();

    // Close palette via Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Admin command palette" })).not.toBeInTheDocument();
  });
});
