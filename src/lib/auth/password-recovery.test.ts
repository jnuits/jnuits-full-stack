import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPasswordRecoveryCookie,
  isPasswordRecoveryActiveForUser,
} from "./password-recovery";

function cookieStore(value: string) {
  return {
    get(name: string) {
      return name === "jnuits-password-recovery" ? { value } : undefined;
    },
  };
}

describe("password recovery proof", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("binds a short-lived proof to the recovered user", () => {
    vi.stubEnv("APP_MAC_SECRET", "recovery-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "legacy-key");
    const proof = buildPasswordRecoveryCookie("user-1", 1_000);

    expect(
      isPasswordRecoveryActiveForUser(
        cookieStore(proof.value),
        "user-1",
        proof.expiresAt.getTime() - 1,
      ),
    ).toBe(true);
    expect(
      isPasswordRecoveryActiveForUser(
        cookieStore(proof.value),
        "user-2",
        proof.expiresAt.getTime() - 1,
      ),
    ).toBe(false);
    expect(
      isPasswordRecoveryActiveForUser(
        cookieStore(proof.value),
        "user-1",
        proof.expiresAt.getTime(),
      ),
    ).toBe(false);
  });

  it("accepts an unexpired proof minted with the former key during rotation", () => {
    vi.stubEnv("APP_MAC_SECRET", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "legacy-key");
    const proof = buildPasswordRecoveryCookie("user-1", 1_000);

    vi.stubEnv("APP_MAC_SECRET", "new-key");
    expect(
      isPasswordRecoveryActiveForUser(
        cookieStore(proof.value),
        "user-1",
        2_000,
      ),
    ).toBe(true);
  });
});
