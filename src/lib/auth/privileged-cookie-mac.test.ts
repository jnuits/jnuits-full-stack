import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDirectoryVerificationCookieValue,
  hashDirectoryVerificationCode,
  hashDirectoryVerificationCodeCandidates,
  isDirectoryVerifiedForUser,
} from "./directory-verification";
import {
  buildStepUpCookie,
  isStepUpActiveForUser,
} from "./step-up";

function cookieStore(name: string, value: string) {
  return {
    get(candidate: string) {
      return candidate === name ? { value } : undefined;
    },
  };
}

describe("privileged cookie MACs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects the old unsigned directory-cookie pair", () => {
    const cookies = {
      get(name: string) {
        return name === "member_directory_verified"
          ? { value: "1" }
          : name === "member_directory_verified_user_id"
            ? { value: "user-1" }
            : undefined;
      },
    };

    expect(isDirectoryVerifiedForUser(cookies, "user-1")).toBe(false);
  });

  it("binds directory verification to the user and expiry", () => {
    vi.stubEnv("APP_MAC_SECRET", "app-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "legacy-key");
    const expiresAt = new Date(20_000);
    const value = createDirectoryVerificationCookieValue("user-1", expiresAt);
    const cookies = cookieStore("member_directory_verified", value);

    expect(isDirectoryVerifiedForUser(cookies, "user-1", 19_999)).toBe(true);
    expect(isDirectoryVerifiedForUser(cookies, "user-2", 19_999)).toBe(false);
    expect(isDirectoryVerifiedForUser(cookies, "user-1", 20_000)).toBe(false);
    expect(
      isDirectoryVerifiedForUser(
        cookieStore("member_directory_verified", `${value}tampered`),
        "user-1",
        19_999,
      ),
    ).toBe(false);
  });

  it("accepts privileged cookies signed with the legacy key during rotation", () => {
    vi.stubEnv("APP_MAC_SECRET", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "legacy-key");
    const directoryValue = createDirectoryVerificationCookieValue(
      "user-1",
      new Date(20_000),
    );
    const stepUpValue = buildStepUpCookie("user-1", 1_000).value;

    vi.stubEnv("APP_MAC_SECRET", "new-key");

    expect(
      isDirectoryVerifiedForUser(
        cookieStore("member_directory_verified", directoryValue),
        "user-1",
        19_000,
      ),
    ).toBe(true);
    expect(
      isStepUpActiveForUser(
        cookieStore("jnuits-step-up", stepUpValue),
        "user-1",
        2_000,
      ),
    ).toBe(true);
  });

  it("returns hashes for both current and legacy persisted directory codes", () => {
    vi.stubEnv("APP_MAC_SECRET", "new-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "legacy-key");

    const candidates = hashDirectoryVerificationCodeCandidates(" abcd ");
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toBe(hashDirectoryVerificationCode("ABCD"));
    expect(new Set(candidates).size).toBe(2);
  });
});
