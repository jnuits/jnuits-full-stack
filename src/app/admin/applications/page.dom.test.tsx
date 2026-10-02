import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ permission: vi.fn(), from: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: mocks.permission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: (client: unknown) => client }));
vi.mock("./membership-actions", () => ({ approveMembershipApplication: vi.fn(), rejectMembershipApplication: vi.fn(), requestMembershipApplicationReview: vi.fn() }));
vi.mock("./alumni-actions", () => ({ approveAlumniOnboardingCase: vi.fn(), rejectAlumniOnboardingCase: vi.fn() }));
import ApplicationsPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({ user: { id: "fictional-operator" } });
  // The external Data API is the boundary; render the real page with empty onboarding queues.
  const query = {
    select: () => query, in: () => query, eq: () => query, order: () => query, limit: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve),
  };
  mocks.from.mockReturnValue(query);
});

describe("existing-member request discovery from Applications", () => {
  it("still directs operators to member Alumni requests when onboarding has no cases", async () => {
    render(await ApplicationsPage());
    expect(screen.getByText("No alumni cases awaiting review")).toBeInTheDocument();
    const section = screen.getByRole("heading", { name: "Requests from existing members" }).closest("section")!;
    expect(within(section).getByRole("link", { name: "Review member Alumni requests" })).toHaveAttribute("href", "/admin/membership?renewalQueue=alumni#membership-renewals");
    expect(within(section).getByRole("link", { name: "Review renewals and departures" })).toHaveAttribute("href", "/admin/membership#membership-renewals");
  });
  it("keeps the existing membership permission guard before any server-side read", async () => {
    mocks.permission.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(ApplicationsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
