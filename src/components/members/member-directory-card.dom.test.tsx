import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemberDirectoryCard } from "./member-directory-card";
vi.mock("next/navigation", () => ({ usePathname: () => "/members", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
describe("member committee office badge", () => {
  it("keeps membership classification and workplace separate from committee office", () => {
    render(<MemberDirectoryCard member={{ id: "fictional", jnuitsId: "JnUITS-2099971", fullName: "Fictional President", memberType: "current", batchNo: 8, departmentCode: "cse", departmentName: "CSE", avatarSecureUrl: null, facebookUrl: null, linkedinUrl: null, websiteUrl: null, currentCommitteeTitles: ["President"], workplace: { visibility: "private", visible: false, currentOrganization: null, designation: null, workLocation: null } }} />);
    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.getByText("President")).toHaveAttribute("title", "Current committee position");
    expect(screen.getByText("Workplace kept private")).toBeInTheDocument();
  });
});
