import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireAdminPermission: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: mocks.requireAdminPermission }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { inspectCertificateImportAction } from "./actions";

const header = "certId,fullName,type,eventName,issueDate";
function form(csv: string) {
  const data = new FormData();
  data.set("csv_data", csv);
  return data;
}

describe("certificate import inspection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPermission.mockResolvedValue({ user: { id: "operator-1" } });
  });

  it("checks the existing manage permission before reading submitted data", async () => {
    mocks.requireAdminPermission.mockRejectedValueOnce(new Error("forbidden"));
    await expect(inspectCertificateImportAction(form("invalid"))).rejects.toThrow("forbidden");
    expect(mocks.requireAdminPermission).toHaveBeenCalledWith("admin.certificates.manage", {
      fallbackPath: "/admin/certificates",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated request without parsing or writing", async () => {
    mocks.requireAdminPermission.mockResolvedValueOnce({ user: null });
    await expect(inspectCertificateImportAction(form("invalid"))).rejects.toThrow("redirect:/admin");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns every invalid-row issue without creating an import batch", async () => {
    const result = await inspectCertificateImportAction(form([
      header,
      "CERT-2099-001,Sample One,Event,Sample Workshop,not-a-date",
      "CERT-2099-002,Sample Two,mystery,Sample Workshop,2099-01-15",
    ].join("\n")));
    expect(result).toMatchObject({ ok: false, issues: [
      expect.objectContaining({ sourceRow: 2, field: "issueDate", acceptedFormat: expect.any(String), example: expect.any(String) }),
      expect.objectContaining({ sourceRow: 3, field: "type", receivedValue: "mystery" }),
    ] });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("reports invalid rows in a mixed file rather than silently omitting them", async () => {
    const result = await inspectCertificateImportAction(form([
      header,
      "CERT-2099-001,Sample One,Event,Sample Workshop,2099-01-15",
      "CERT-2099-002,Sample Two,Event,Sample Workshop,invalid",
    ].join("\n")));
    expect(result).toMatchObject({ ok: false, issues: [expect.objectContaining({ sourceRow: 3 })] });
    expect(result.message).toMatch(/1.*valid.*1.*issue/i);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("confirms a valid file but leaves all writes to the existing import action", async () => {
    const result = await inspectCertificateImportAction(form(`${header}\nCERT-2099-001,Sample One,Event,Sample Workshop,2099-01-15`));
    expect(result).toMatchObject({ ok: true, issues: [] });
    expect(result.message).toMatch(/1.*valid/i);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns a safe actionable error for malformed CSV", async () => {
    const result = await inspectCertificateImportAction(form(`${header}\n"unmatched`));
    expect(result).toMatchObject({ ok: false, issues: [], message: expect.stringMatching(/unmatched quotes/i) });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
