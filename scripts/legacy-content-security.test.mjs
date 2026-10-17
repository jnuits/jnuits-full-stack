import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createConnection: vi.fn(), readFileSync: vi.fn(),
  legacyEnv: { DATABASE_HOST: "legacy.example.test", DATABASE_NAME: "legacy", DATABASE_PORT: "3306", DATABASE_USERNAME: "fixture", DATABASE_PASSWORD: "fixture" },
}));
vi.mock("mysql2/promise", () => ({ default: { createConnection: mocks.createConnection } }));
vi.mock("node:fs", () => ({ default: { existsSync: () => true, readFileSync: mocks.readFileSync } }));
vi.mock("dotenv", () => ({ default: { config: vi.fn(), parse: () => mocks.legacyEnv } }));

import { buildLegacyMysqlConnection, createCloudinarySignature } from "./lib/legacy-content.mjs";

describe("legacy recovery authenticity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LEGACY_DATABASE_CA_PATH", "");
    vi.stubEnv("LEGACY_DATABASE_TLS_INSECURE", "0");
    mocks.legacyEnv.DATABASE_HOST = "legacy.example.test";
  });
  afterEach(() => vi.unstubAllEnvs());
  it("requires certificate chain and DNS identity verification by default", async () => {
    await buildLegacyMysqlConnection();
    expect(mocks.createConnection).toHaveBeenCalledWith(expect.objectContaining({ ssl: { rejectUnauthorized: true, verifyIdentity: true } }));
  });
  it("preserves trusted private CA support", async () => {
    vi.stubEnv("LEGACY_DATABASE_CA_PATH", "private-ca.pem");
    mocks.readFileSync.mockReturnValue("fixture CA");
    await buildLegacyMysqlConnection();
    expect(mocks.createConnection).toHaveBeenCalledWith(expect.objectContaining({ ssl: { ca: "fixture CA", rejectUnauthorized: true, verifyIdentity: true } }));
  });
  it("rejects the retired TLS bypass before opening a connection", async () => {
    vi.stubEnv("LEGACY_DATABASE_TLS_INSECURE", "1");
    await expect(buildLegacyMysqlConnection()).rejects.toThrow("LEGACY_DATABASE_CA_PATH");
    expect(mocks.createConnection).not.toHaveBeenCalled();
  });
  it.each(["127.0.0.1", "::1", "192.0.2.1"])("requires a certificate-matching DNS host instead of an unchecked IP: %s", async (host) => {
    mocks.legacyEnv.DATABASE_HOST = host;
    await expect(buildLegacyMysqlConnection()).rejects.toThrow("DNS hostname");
    expect(mocks.createConnection).not.toHaveBeenCalled();
  });
  it("uses the same SHA-256 request protocol in legacy imports", () => {
    expect(createCloudinarySignature({ timestamp: 1315060510 }, "abcd"))
      .toBe("5652e549a70bdc03f73a633a23b7d3f3b067d72fff26dd15b25997f46fdf6439");
  });
});
