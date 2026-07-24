import { expect, test, type Locator, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_NORMAL_ADMIN_EMAIL;
const adminPassword = process.env.E2E_NORMAL_ADMIN_PASSWORD;
const approveCaseId = process.env.E2E_ALUMNI_APPROVE_CASE_ID;
const rejectCaseId = process.env.E2E_ALUMNI_REJECT_CASE_ID;
const dedupeCaseId = process.env.E2E_ALUMNI_DEDUPE_CASE_ID;
const expectedJnuitsId = process.env.E2E_ALUMNI_EXPECTED_JNUITS_ID;
const formSlug = process.env.E2E_ALUMNI_FORM_SLUG;
const submitPayloadJson = process.env.E2E_ALUMNI_SUBMIT_PAYLOAD_JSON;
const confirmUrl = process.env.E2E_ALUMNI_CONFIRM_URL;
const enabled = process.env.E2E_AUTH_SMOKE === "1" &&
  process.env.E2E_ALUMNI_WORKFLOW === "1" &&
  [adminEmail, adminPassword, approveCaseId, rejectCaseId, dedupeCaseId, expectedJnuitsId, formSlug, submitPayloadJson, confirmUrl].every(Boolean);

function requireValue(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for protected alumni workflow verification.`);
  return value;
}

async function signInAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.locator("#admin-login-email").fill(requireValue(adminEmail, "E2E_NORMAL_ADMIN_EMAIL"));
  await page.locator("#admin-login-password").fill(requireValue(adminPassword, "E2E_NORMAL_ADMIN_PASSWORD"));
  await page.getByRole("button", { name: "Sign in to admin" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: 30_000 });
  test.skip(["/admin/mfa/setup", "/admin/mfa/challenge"].includes(new URL(page.url()).pathname), "Protected account requires interactive MFA completion.");
}

function caseForm(page: Page, caseId: string): Locator {
  return page.locator(`form:has(input[name="caseId"][value="${caseId}"])`);
}

async function approveCase(page: Page, caseId: string, note: string) {
  await page.goto("/admin/applications#alumni-onboarding");
  const form = caseForm(page, caseId);
  await expect(form).toBeVisible();
  await form.locator('textarea[name="reviewNote"]').fill(note);
  await form.getByRole("button", { name: "Approve and issue claim" }).click();
  await page.waitForURL(/\/admin\/applications#alumni-onboarding/);
}

test.describe("protected alumni onboarding workflow", () => {
  test.skip(!enabled, "Provide the complete isolated pre-production alumni fixture set.");

  test("submits and confirms the published alumni form", async ({ page }) => {
    const payload = JSON.parse(requireValue(submitPayloadJson, "E2E_ALUMNI_SUBMIT_PAYLOAD_JSON"));
    const response = await page.request.post(`/api/forms/${requireValue(formSlug, "E2E_ALUMNI_FORM_SLUG")}/submit`, { data: payload });
    expect(response.status()).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ confirmationRequired: true, success: true });
    await page.goto(requireValue(confirmUrl, "E2E_ALUMNI_CONFIRM_URL"));
    await expect(page.locator("body")).toContainText(/confirmed|email confirmed|submission confirmed/i);
  });

  test("approves, deduplicates, exposes claim handoff, and rejects", async ({ page }) => {
    await signInAdmin(page);
    await approveCase(page, requireValue(approveCaseId, "E2E_ALUMNI_APPROVE_CASE_ID"), "Protected pre-production approval verification.");
    await expect(page.getByText("Alumni onboarding approved")).toBeVisible();
    await expect(page.getByText(requireValue(expectedJnuitsId, "E2E_ALUMNI_EXPECTED_JNUITS_ID"), { exact: false })).toBeVisible();
    await page.goto("/admin/invitations");
    await expect(page.getByText(requireValue(expectedJnuitsId, "E2E_ALUMNI_EXPECTED_JNUITS_ID"), { exact: false })).toBeVisible();
    await approveCase(page, requireValue(dedupeCaseId, "E2E_ALUMNI_DEDUPE_CASE_ID"), "Protected duplicate identity verification.");
    await expect(page.locator("body")).toContainText(/already approved|reactivated safely|can now claim/i);
    await page.goto("/admin/applications#alumni-onboarding");
    const rejection = caseForm(page, requireValue(rejectCaseId, "E2E_ALUMNI_REJECT_CASE_ID"));
    await expect(rejection).toBeVisible();
    await rejection.locator('textarea[name="reviewNote"]').fill("Protected pre-production rejection verification.");
    await rejection.getByRole("button", { name: "Reject" }).click();
    await page.waitForURL(/\/admin\/applications#alumni-onboarding/);
    await expect(page.getByText("Alumni onboarding rejected")).toBeVisible();
  });
});
