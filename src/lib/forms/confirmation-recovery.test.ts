import { describe, expect, it } from "vitest";
import * as confirmationModule from "@/lib/forms/confirmation";

type RecoveryHelpers = {
  FORM_CONFIRMATION_RESEND_ACCEPTED_MESSAGE?: string;
  buildFormConfirmationUrl?: (options: {
    baseUrl: string;
    formSlug: string;
    submissionId: string;
    token: string;
  }) => string;
  getFormConfirmationResendEndpoint?: (formSlug: string) => string;
};

const recoveryHelpers = confirmationModule as typeof confirmationModule & RecoveryHelpers;

describe("form confirmation recovery", () => {
  it("keeps the form slug in confirmation links", () => {
    expect(recoveryHelpers.buildFormConfirmationUrl).toBeTypeOf("function");
    const url = recoveryHelpers.buildFormConfirmationUrl?.({
      baseUrl: "https://jnuits.example.test",
      formSlug: "membership-2026",
      submissionId: "11111111-1111-4111-8111-111111111111",
      token: "a".repeat(43),
    });
    expect(url).toBe(
      "https://jnuits.example.test/forms/confirm?submission=11111111-1111-4111-8111-111111111111&token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&form=membership-2026"
    );
  });

  it("builds a form-scoped resend endpoint and generic accepted message", () => {
    expect(recoveryHelpers.getFormConfirmationResendEndpoint).toBeTypeOf("function");
    expect(recoveryHelpers.getFormConfirmationResendEndpoint?.("membership-2026")).toBe(
      "/api/forms/membership-2026/confirmations/resend"
    );
    expect(recoveryHelpers.FORM_CONFIRMATION_RESEND_ACCEPTED_MESSAGE).toBe(
      "If an eligible pending submission matches that email, a new confirmation link is on its way."
    );
  });
});
