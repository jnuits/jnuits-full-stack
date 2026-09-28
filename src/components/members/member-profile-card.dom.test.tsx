import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { PublicMemberProfile } from "@/lib/members/public-profile-contract";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { MemberProfileCard } from "./member-profile-card";

const restrictedProfile: PublicMemberProfile = {
  avatarSecureUrl: null,
  committeeAppointments: [
    {
      assignmentId: "assignment-1",
      dateConfidence: "estimated",
      endsOn: null,
      roleCode: "president",
      roleGroup: "executive",
      roleTitle: "President",
      roleTitleBn: null,
      startsOn: "2026-07-07",
      termNumber: 6,
      termSlug: "sixth-committee",
      termTitle: "6th Executive Committee",
    },
  ],
  departmentName: "Computer Science and Engineering",
  fullName: "Restricted Executive",
  jnuitsId: "JnUITS-2023001",
  scope: "committee",
};

describe("MemberProfileCard committee fallback", () => {
  it("shows committee service without rendering directory-only details", () => {
    render(<MemberProfileCard member={restrictedProfile} />);

    expect(screen.getByRole("heading", { name: "Restricted Executive" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Committee service" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /6th Executive Committee/i })).toHaveAttribute(
      "href",
      "/committee/sixth-committee"
    );
    expect(screen.getByText("Estimated dates")).toBeInTheDocument();
    expect(screen.queryByText("Workplace")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Connect" })).toBeNull();
    expect(screen.queryByText("Current Member")).toBeNull();
  });
});
