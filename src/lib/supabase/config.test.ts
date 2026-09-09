import { afterEach, describe, expect, it, vi } from "vitest";

import { getApplicationMacKey, getApplicationMacKeys } from "./config";

describe("application MAC key rotation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs with the dedicated key and keeps the Supabase key for legacy verification", () => {
    vi.stubEnv("APP_MAC_SECRET", "new-app-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "legacy-supabase-key");

    expect(getApplicationMacKey()).toBe("new-app-key");
    expect(getApplicationMacKeys()).toEqual([
      "new-app-key",
      "legacy-supabase-key",
    ]);
  });

  it("deduplicates equal keys and falls back to the Supabase key", () => {
    vi.stubEnv("APP_MAC_SECRET", "same-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "same-key");
    expect(getApplicationMacKeys()).toEqual(["same-key"]);

    vi.stubEnv("APP_MAC_SECRET", "");
    expect(getApplicationMacKeys()).toEqual(["same-key"]);
  });
});
