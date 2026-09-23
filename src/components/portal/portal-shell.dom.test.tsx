import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/portal",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/auth/logout-button", () => ({
  LogoutButton: () => <button type="button">Sign out</button>,
}));

vi.mock("@/components/layout/site-brand", () => ({
  SiteBrand: () => <span>JnUITS</span>,
}));

vi.mock("@/components/profile/profile-avatar", () => ({
  ProfileAvatar: () => <div data-testid="profile-avatar" />,
}));

vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => <button aria-label="Toggle color theme" type="button" />,
}));

import { PortalShell } from "@/components/portal/portal-shell";

describe("PortalShell", () => {
  it("renders an accessible skip link targeting the main portal content", () => {
    render(
      <PortalShell memberName="Jane Doe" jnuitsId="JN-001">
        <div>Child Content</div>
      </PortalShell>
    );

    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#portal-main-content");

    const mainElement = screen.getByRole("main");
    expect(mainElement).toHaveAttribute("id", "portal-main-content");
    expect(mainElement).toHaveAttribute("tabindex", "-1");
  });

  it("opens and closes mobile sidebar drawer and toggles body scroll lock", async () => {
    const user = userEvent.setup();

    render(
      <PortalShell memberName="Jane Doe" jnuitsId="JN-001">
        <div>Child Content</div>
      </PortalShell>
    );

    const aside = screen.getByRole("complementary", { name: /member portal navigation/i });
    expect(aside).toHaveAttribute("data-open", "false");
    expect(document.body.style.overflow).toBe("");

    const toggleButton = screen.getByRole("button", { name: /open sidebar/i });
    await user.click(toggleButton);

    expect(aside).toHaveAttribute("data-open", "true");
    expect(document.body.style.overflow).toBe("hidden");

    // Close button inside sidebar
    const closeButton = screen.getByRole("button", { name: /close navigation/i });
    await user.click(closeButton);

    expect(aside).toHaveAttribute("data-open", "false");
    expect(document.body.style.overflow).toBe("");
    expect(toggleButton).toHaveFocus();
  });

  it("closes drawer on Escape key press and restores focus to toggle button", async () => {
    const user = userEvent.setup();

    render(
      <PortalShell memberName="Jane Doe" jnuitsId="JN-001">
        <div>Child Content</div>
      </PortalShell>
    );

    const toggleButton = screen.getByRole("button", { name: /open sidebar/i });
    await user.click(toggleButton);

    const aside = screen.getByRole("complementary", { name: /member portal navigation/i });
    expect(aside).toHaveAttribute("data-open", "true");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(aside).toHaveAttribute("data-open", "false");
    expect(document.body.style.overflow).toBe("");
    expect(toggleButton).toHaveFocus();
  });

  it("moves focus into the mobile drawer and traps Tab navigation inside it", async () => {
    const user = userEvent.setup();

    render(
      <PortalShell memberName="Jane Doe" jnuitsId="JN-001">
        <button type="button">Page action</button>
      </PortalShell>
    );

    const toggleButton = screen.getByRole("button", { name: /open sidebar/i });
    await user.click(toggleButton);

    const aside = screen.getByRole("complementary", {
      name: /member portal navigation/i,
    });
    const closeButton = within(aside).getByRole("button", {
      name: /close navigation/i,
    });
    const firstDrawerControl = within(aside).getByRole("button", {
      name: /toggle color theme/i,
    });
    const drawerLinks = within(aside).getAllByRole("link");
    const lastDrawerLink = drawerLinks.at(-1);

    expect(closeButton).toHaveFocus();
    expect(lastDrawerLink).toBeDefined();

    lastDrawerLink?.focus();
    await user.tab();
    expect(firstDrawerControl).toHaveFocus();

    firstDrawerControl.focus();
    await user.tab({ shift: true });
    expect(lastDrawerLink).toHaveFocus();
  });

  it("renders advisor navigation groups when portalRole is advisor", () => {
    render(
      <PortalShell memberName="Dr. Advisor" portalRole="advisor">
        <div>Advisor Content</div>
      </PortalShell>
    );

    const aside = screen.getByRole("complementary", { name: /advisor portal navigation/i });
    expect(aside).toBeInTheDocument();
    expect(screen.getByText("Advisor Workspace")).toBeInTheDocument();
    expect(screen.queryByText("Member Services")).not.toBeInTheDocument();
  });
});
