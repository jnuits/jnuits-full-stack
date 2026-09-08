import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hashInvitationCode,
  hashInvitationCodeCandidates,
} from "./invitation-code";

describe("invitation code MAC rotation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("signs new codes with the primary key and verifies legacy hashes", () => {
    vi.stubEnv("APP_MAC_SECRET", "new-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "legacy-key");

    const candidates = hashInvitationCodeCandidates(" invite-code ");
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toBe(hashInvitationCode("INVITE-CODE"));
    expect(new Set(candidates).size).toBe(2);
  });
});
