import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import { findAuthUserByEmail } from "@/lib/auth/auth-user-lookup";

function createAdminClientMock() {
  return {
    auth: {
      admin: {
        getUserById: mocks.getUserById,
      },
    },
    rpc: mocks.rpc,
  };
}

describe("findAuthUserByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the service-only lookup RPC instead of paginating Auth users", async () => {
    mocks.rpc.mockResolvedValue({ data: "user-1", error: null });
    mocks.getUserById.mockResolvedValue({
      data: { user: { email: "member@example.com", id: "user-1" } },
      error: null,
    });

    const user = await findAuthUserByEmail(
      createAdminClientMock() as never,
      " Member@Example.com ",
    );

    expect(mocks.rpc).toHaveBeenCalledWith("find_auth_user_id_by_email", {
      target_email: "member@example.com",
    });
    expect(mocks.getUserById).toHaveBeenCalledWith("user-1");
    expect(user).toMatchObject({ id: "user-1" });
  });

  it("does not call Auth Admin when no matching user exists", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      findAuthUserByEmail(createAdminClientMock() as never, "new@example.com"),
    ).resolves.toBeNull();
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("does not query for an empty email", async () => {
    await expect(
      findAuthUserByEmail(createAdminClientMock() as never, "   "),
    ).resolves.toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});