import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AdminRecommendationsCard,
  type AdminRecommendation,
} from "./admin-recommendations-card";

describe("AdminRecommendationsCard Component", () => {
  it("renders up to 3 recommendations with labels, explanations, and action links", () => {
    const items: AdminRecommendation[] = [
      {
        id: "rec-1",
        label: "Complete admin display name and photo",
        explanation: "Your admin account is missing an uploaded avatar photo.",
        href: "/admin/settings/profile",
      },
      {
        id: "rec-2",
        label: "Set up authenticator (MFA)",
        explanation: "Protect your admin role with multi-factor authentication.",
        href: "/admin/mfa/setup",
      },
      {
        id: "rec-3",
        label: "Review pending membership applications",
        explanation: "3 pending member applications are awaiting operator review.",
        href: "/admin/applications",
      },
      {
        id: "rec-4",
        label: "Fourth item that should not be displayed",
        explanation: "Excess recommendation item.",
        href: "/admin/reports",
      },
    ];

    render(<AdminRecommendationsCard recommendations={items} />);

    expect(
      screen.getByRole("heading", { name: "Suggested administrative actions" })
    ).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Administrative recommendations" });
    const articles = list.querySelectorAll("article");
    expect(articles).toHaveLength(3);

    expect(screen.getByText("Complete admin display name and photo")).toBeInTheDocument();
    expect(screen.getByText("Set up authenticator (MFA)")).toBeInTheDocument();
    expect(screen.getByText("Review pending membership applications")).toBeInTheDocument();
    expect(
      screen.queryByText("Fourth item that should not be displayed")
    ).not.toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: /Take action/i });
    expect(links[0]).toHaveAttribute("href", "/admin/settings/profile");
    expect(links[1]).toHaveAttribute("href", "/admin/mfa/setup");
    expect(links[2]).toHaveAttribute("href", "/admin/applications");
  });

  it("renders friendly all-complete state when recommendations are empty", () => {
    render(<AdminRecommendationsCard recommendations={[]} />);

    expect(screen.getByText("All recommendations complete")).toBeInTheDocument();
    expect(
      screen.getByText(/Your profile, security settings, and assigned duty queues have no pending action items/i)
    ).toBeInTheDocument();
  });
});
