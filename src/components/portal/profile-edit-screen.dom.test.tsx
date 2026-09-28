import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveDepartmentOptions: vi.fn(),
  getAuthCaptchaUiConfig: vi.fn(),
  getPortalMemberSnapshot: vi.fn(),
  isStepUpActiveForUser: vi.fn(),
  requirePortalUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn() })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

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

vi.mock("@/components/portal/portal-shell", () => ({
  PortalShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/profile/profile-avatar", () => ({
  ProfileAvatar: () => <span aria-hidden="true" />,
}));

vi.mock("@/components/auth/turnstile-field", () => ({
  TurnstileField: () => <div data-testid="turnstile" />,
}));

vi.mock("@/lib/auth/session", () => ({
  requirePortalUser: mocks.requirePortalUser,
}));

vi.mock("@/lib/auth/step-up", () => ({
  isStepUpActiveForUser: mocks.isStepUpActiveForUser,
}));

vi.mock("@/lib/departments.server", () => ({
  getActiveDepartmentOptions: mocks.getActiveDepartmentOptions,
}));

vi.mock("@/lib/portal/member", () => ({
  getPortalMemberSnapshot: mocks.getPortalMemberSnapshot,
}));

vi.mock("@/lib/security/captcha", () => ({
  getAuthCaptchaUiConfig: mocks.getAuthCaptchaUiConfig,
}));

import { ProfileEditScreen } from "@/components/portal/profile-edit-screen";

const snapshot = {
  access: {
    lifecycleStatus: "current",
    portalAccessStatus: "active",
  },
  directoryVerified: false,
  member: {
    avatar_secure_url: null,
    current_organization: "Private Organization",
    department_code: "CSE",
    designation: "Private Role",
    email: "private@example.test",
    facebook_url: "https://facebook.example.test/private",
    full_name: "Private Member Name",
    jnuits_id: "JnUITS-2023001",
    lifecycle_status: "current",
    linkedin_url: "https://linkedin.example.test/private",
    member_type: "current",
    phone: "+8801700000000",
    portal_access_status: "active",
    professional_visibility: "members-only",
    website_url: "https://private.example.test",
    work_location: "Dhaka",
  },
  profileChangeRequests: [],
  workplaceRequests: [],
};

beforeEach(() => {
  mocks.requirePortalUser.mockResolvedValue({
    user: {
      email: "member@example.test",
      id: "user-1",
      portalRole: "member",
    },
  });
  mocks.getPortalMemberSnapshot.mockResolvedValue(snapshot);
  mocks.getActiveDepartmentOptions.mockResolvedValue([
    { code: "CSE", name: "Computer Science & Engineering" },
  ]);
  mocks.getAuthCaptchaUiConfig.mockReturnValue({ required: false, siteKey: "" });
});

describe("ProfileEditScreen", () => {
  it("shows only the password unlock while profile editing is locked", async () => {
    mocks.isStepUpActiveForUser.mockReturnValue(false);

    render(await ProfileEditScreen());

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.queryAllByDisplayValue("Private Member Name")).toHaveLength(0);
    expect(screen.queryAllByDisplayValue("Private Organization")).toHaveLength(0);
    expect(screen.queryByLabelText(/directory verification code/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save direct changes/i })).not.toBeInTheDocument();
    expect(screen.getByText(/profile details stay hidden/i)).toBeInTheDocument();
  });

  it("reveals edit forms after the current-password unlock without a directory code", async () => {
    mocks.isStepUpActiveForUser.mockReturnValue(true);

    render(await ProfileEditScreen());

    expect(screen.getAllByDisplayValue("Private Member Name").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Private Organization")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save direct changes/i })).toBeEnabled();
    expect(screen.queryByLabelText(/directory verification code/i)).not.toBeInTheDocument();
  });
});
