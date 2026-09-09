import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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

vi.mock("@/components/layout/site-brand", () => ({
  SiteBrand: () => <span>JnU IT Society</span>,
}));

vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => <button aria-label="Toggle color theme" type="button" />,
}));

import { SiteHeader } from "@/components/layout/site-header";

describe("SiteHeader", () => {
  it("keeps membership promotion out of both persistent and mobile navigation", async () => {
    const user = userEvent.setup();

    render(<SiteHeader />);

    expect(screen.queryByRole("link", { name: /join(?: as a member)?/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Portal" })).toHaveAttribute(
      "href",
      "/portal/dashboard",
    );

    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));

    const mobileNavigation = await screen.findByRole("navigation", {
      name: "Mobile navigation",
    });

    expect(
      within(mobileNavigation).queryByRole("link", { name: /join(?: as a member)?/i }),
    ).not.toBeInTheDocument();
  });
});
