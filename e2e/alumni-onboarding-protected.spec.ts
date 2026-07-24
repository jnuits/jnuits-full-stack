import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.E2E_AUTH_SMOKE === "1" && process.env.E2E_ALUMNI_WORKFLOW === "1";
const adminEmail = process.env.E2E_NORMAL_ADMIN_EMAIL;
const adminPassword = process.env.E2E_NORMAL_ADMIN_PASSWORD;
const approveCaseId = process.env.E2E_ALUMNI_APPROVE_CASE_ID;
const rejectCaseId = process.env.E2E_ALUMNI_REJECT_CASE_ID;
const expectedJnuitsId = process.env.E2E_ALUMNI_EXPECTED_JNUITS_ID;

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

test.describe("protected alumni onboarding decisions", () => {
  test.skip(!enabled, "Set E2E_ALUMNI_WORKFLOW=1 with isolated pre-production fixtures.");

  test("approves once, exposes canonical claim handoff, and rejects a separate case", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/admin/applications#alumni-onboarding");

    const approval = caseForm(page, requireValue(approveCaseId, "E2E_ALUMNI_APPROVE_CASE_ID"));
    await expect(approval).toBeVisible();
    await approval.locator('textarea[name="reviewNote"]').fill("Protected pre-production approval verification.");
    await approval.getByRole("button", { name: "Approve and issue claim" }).click();
    await page.waitForURL(/\/admin\/applications#alumni-onboarding/);
    await expect(page.getByText("Alumni onboarding approved")).toBeVisible();
    await expect(page.getByText(requireValue(expectedJnuitsId, "E2E_ALUMNI_EXPECTED_JNUITS_ID"), { exact: false })).toBeVisible();

    await page.goto("/admin/invitations");
    await expect(page.getByText(requireValue(expectedJnuitsId, "E2E_ALUMNI_EXPECTED_JNUITS_ID"), { exact: false })).toBeVisible();

    await page.goto("/admin/applications#alumni-onboarding");
    const rejection = caseForm(page, requireValue(rejectCaseId, "E2E_ALUMNI_REJECT_CASE_ID"));
    await expect(rejection).toBeVisible();
    await rejection.locator('textarea[name="reviewNote"]').fill("Protected pre-production rejection verification.");
    await rejection.getByRole("button", { name: "Reject" }).click();
    await page.waitForURL(/\/admin\/applications#alumni-onboarding/);
    await expect(page.getByText("Alumni onboarding rejected")).toBeVisible();
  });
});
