import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { projectCurrentCommitteeTitles } from "@/lib/committee/current-titles";
import { MemberDirectoryCard } from "./member-directory-card";

vi.mock("next/navigation", () => ({
  usePathname: () => "/members",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

const member = {
  id: "fictional", jnuitsId: "JnUITS-2099971", fullName: "Fictional President",
  memberType: "current" as const, batchNo: 8, departmentCode: "cse", departmentName: "CSE",
  avatarSecureUrl: null, facebookUrl: null, linkedinUrl: null, websiteUrl: null,
  currentCommitteeTitles: ["President"],
  workplace: { visibility: "private" as const, visible: false, currentOrganization: null, designation: null, workLocation: null },
};

describe("member committee office badge", () => {
  it.each(["current", "alumni"] as const)("shows the current EC office instead of %s classification", memberType => {
    render(<MemberDirectoryCard member={{ ...member, memberType }} />);
    expect(screen.getByText("President")).toHaveAttribute("title", "Current committee position");
    expect(screen.queryByText("Member")).not.toBeInTheDocument();
    expect(screen.queryByText("Alumni")).not.toBeInTheDocument();
    expect(screen.getByText("Workplace kept private")).toBeInTheDocument();
  });

  it.each([["current", "Member"], ["alumni", "Alumni"]] as const)("shows %s classification without a current EC office", (memberType, label) => {
    render(<MemberDirectoryCard member={{ ...member, memberType, currentCommitteeTitles: [] }} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("President")).not.toBeInTheDocument();
  });

  it("restores classification after the current appointment is revoked", () => {
    const term = { id: "term", is_current: true, is_public: true, status: "active", term_kind: "executive" };
    const position = { term_id: "term", role_id: "role", is_public: true, public_label: "President", role_group: "executive", priority: 10 };
    const assignment = { id: "appointment", member_id: member.id, term_id: term.id, role_id: position.role_id, is_public: true, status: "active", public_title_override: null, sort_order: 0 };
    const titles = projectCurrentCommitteeTitles([term], [position], [assignment]).get(member.id) ?? [];
    const { rerender } = render(<MemberDirectoryCard member={{ ...member, currentCommitteeTitles: titles }} />);
    expect(screen.queryByText("Member")).not.toBeInTheDocument();
    const revoked = projectCurrentCommitteeTitles([term], [position], [{ ...assignment, status: "revoked" }]).get(member.id) ?? [];
    rerender(<MemberDirectoryCard member={{ ...member, currentCommitteeTitles: revoked }} />);
    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.queryByText("President")).not.toBeInTheDocument();
    expect(screen.getByText("Fictional President")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy member ID JnUITS-2099971" })).toBeInTheDocument();
  });

  it("retains all eligible current office labels", () => {
    render(<MemberDirectoryCard member={{ ...member, currentCommitteeTitles: ["President", "Workshop Secretary"] }} />);
    expect(screen.getByText("President")).toBeInTheDocument();
    expect(screen.getByText("Workshop Secretary")).toBeInTheDocument();
    expect(screen.queryByText("Member")).not.toBeInTheDocument();
  });
});
