import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminClient: vi.fn(),
  checkAdminMFA: vi.fn(),
  requireAdminUser: vi.fn(),
  sessionClient: vi.fn(),
}));

vi.mock("@/lib/auth/mfa", () => ({
  checkAdminMFA: (...args: unknown[]) => mocks.checkAdminMFA(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdminUser: (...args: unknown[]) => mocks.requireAdminUser(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.adminClient(),
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.sessionClient(),
}));

import { getAdminSettingsSnapshot } from "@/lib/admin/settings";

function makeQuery(result: unknown) {
  const query = {
    eq: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);

  return query;
}

function createAdminClientMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === "rbac_user_platform_roles") {
        return makeQuery({
          data: [
            {
              granted_at: "2026-01-01T00:00:00.000Z",
              note: null,
              rbac_platform_roles: { code: "admin", display_name: "Admin" },
              scope: "platform",
            },
          ],
          error: null,
        });
      }

      if (table === "security_events") {
        return makeQuery({ data: [], error: null });
      }

      if (table === "portal_user_settings") {
        return makeQuery({
          data: {
            mentorship_opt_in: false,
            notification_email_opt_in: true,
            preferred_theme: "system",
            ticket_digest_opt_in: true,
          },
          error: null,
        });
      }

      if (table === "security_settings") {
        return makeQuery({
          data: {
            admin_totp_enforced: true,
            updated_at: "2026-01-01T00:00:00.000Z",
            updated_by_user_id: null,
          },
          error: null,
        });
      }

      if (table === "members") {
        return makeQuery({ data: null, error: null });
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("getAdminSettingsSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminUser.mockResolvedValue({
      user: {
        email: "operator@example.com",
        id: "operator-1",
      },
    });
    mocks.checkAdminMFA.mockResolvedValue({ ok: true, redirectTo: null });
    mocks.sessionClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email_confirmed_at: "2026-01-01T00:00:00.000Z" } },
          error: null,
        }),
      },
      from: vi.fn(),
    });
    mocks.adminClient.mockReturnValue(createAdminClientMock());
  });

  it("uses the service client for server-owned settings data without restoring browser grants", async () => {
    const snapshot = await getAdminSettingsSnapshot();
    const adminClient = mocks.adminClient.mock.results[0]?.value;
    const sessionClient = await mocks.sessionClient.mock.results[0]?.value;

    expect(snapshot?.roleAssignments).toEqual([
      {
        grantedAt: "2026-01-01T00:00:00.000Z",
        note: null,
        roleCode: "admin",
        roleDisplayName: "Admin",
        scope: "platform",
      },
    ]);
    expect(adminClient.from).toHaveBeenCalledWith("rbac_user_platform_roles");
    expect(adminClient.from).toHaveBeenCalledWith("security_events");
    expect(adminClient.from).toHaveBeenCalledWith("portal_user_settings");
    expect(sessionClient.from).not.toHaveBeenCalled();
  });
});