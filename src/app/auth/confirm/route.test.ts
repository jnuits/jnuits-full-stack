import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { GET } from "./route";

describe("auth confirmation recovery proof", () => {
  beforeEach(() => {
    vi.stubEnv("APP_MAC_SECRET", "test-app-mac-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-legacy-key");
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { app_metadata: {}, email: "member@example.test", id: "user-1" } },
        }),
        verifyOtp: vi.fn().mockResolvedValue({ error: null }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("mints a recovery proof only after a successful recovery OTP", async () => {
    const response = await GET(
      new NextRequest(
        "https://jnuits.org.bd/auth/confirm?token_hash=valid&type=recovery&next=/reset-password",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://jnuits.org.bd/reset-password",
    );
    expect(response.cookies.get("jnuits-password-recovery")?.value).toMatch(
      /^user-1\.\d+\.[a-f0-9]{64}$/,
    );
  });
});
