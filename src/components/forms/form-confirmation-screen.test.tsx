import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  resolve(process.cwd(), "src/components/forms/form-confirmation-screen.tsx"),
  "utf8"
);
const page = readFileSync(
  resolve(process.cwd(), "src/app/(public)/forms/confirm/page.tsx"),
  "utf8"
);

describe("expired form confirmation recovery", () => {
  it("renders a direct recovery form only for an expired link with form context", () => {
    expect(component).toContain("FormConfirmationRecoveryForm");
    expect(component).toContain('state.status === "expired" && formSlug');
    expect(component).toContain("formSlug={formSlug}");
  });

  it("validates and passes form slug plus CAPTCHA config from the confirmation page", () => {
    expect(page).toContain('typeof resolved.form === "string"');
    expect(page).toContain("slugPattern.test(rawFormSlug)");
    expect(page).toContain("captcha={getAuthCaptchaUiConfig()}");
    expect(page).toContain("formSlug={formSlug}");
  });
});
