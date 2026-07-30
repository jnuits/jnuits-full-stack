import { afterEach, describe, expect, it, vi } from "vitest";

import { collectPendingPublicFormUploads } from "@/components/forms/public-form-screen";
import { PUBLIC_FORM_HONEYPOT_CONTROL_NAME } from "@/lib/forms/control-names";
import { parseFormDefinition } from "@/lib/forms/definition";

const definition = parseFormDefinition({
  fields: [
    { id: "website", label: "Website", required: true, type: "text" },
    { id: "identity_document", label: "Identity document", maxFiles: 1, required: true, type: "pdf" },
  ],
  payment: { enabled: false },
});

function uploadFile() {
  const file = new File([new Uint8Array([1, 2, 3])], "identity.pdf", {
    type: "application/pdf",
  });

  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new Uint8Array([1, 2, 3]).buffer,
  });

  return file;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public form non-question controls", () => {
  it("collects a required upload when the respondent answers a Website question", async () => {
    vi.stubGlobal("crypto", {
      subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) },
    });
    const formData = new FormData();
    formData.set("website", "https://member.example.test");
    formData.set("identity_document", uploadFile());

    const result = await collectPendingPublicFormUploads(formData, definition);

    expect(result.honeypot).toBe("");
    expect(result.uploads).toHaveLength(1);
    expect(result.uploads[0]).toMatchObject({ fieldId: "identity_document" });
  });

  it("short-circuits uploads only for the structurally unreachable honeypot name", async () => {
    const formData = new FormData();
    formData.set("website", "https://member.example.test");
    formData.set(PUBLIC_FORM_HONEYPOT_CONTROL_NAME, "https://spam.example.test");
    formData.set("identity_document", uploadFile());

    const result = await collectPendingPublicFormUploads(formData, definition);

    expect(result.honeypot).toBe("https://spam.example.test");
    expect(result.uploads).toEqual([]);
  });
});
