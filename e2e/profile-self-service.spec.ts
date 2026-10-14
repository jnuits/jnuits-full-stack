import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const enabled = process.env.ADMIN_VERIFICATION_QA === "DISPOSABLE_SCRATCH" && process.env.PROFILE_SELF_SERVICE_QA === "DISPOSABLE_SCRATCH";
const baseURL = "http://127.0.0.1:3127";
test.use({ trace: "off", screenshot: "off", actionTimeout: 15_000, navigationTimeout: 45_000 });
async function fixture(action: string, input: Record<string, unknown> = {}) {
  const response = await fetch(`${process.env.ADMIN_VERIFICATION_QA_BRIDGE}/${action}`, { method: "POST", headers: { Authorization: `Bearer ${process.env.ADMIN_VERIFICATION_QA_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`Disposable fixture rejected ${action}.`);
  return response.json();
}
async function signedIn(context: BrowserContext, name: string) {
  const account = await fixture("account", { name });
  await context.addCookies(account.cookies.map((cookie: { name: string; value: string }) => ({ ...cookie, domain: "127.0.0.1", path: "/", sameSite: "Lax" })));
  return account;
}
async function healthy(page: Page) {
  await expect(page.locator("body")).not.toContainText(/Runtime Error|Application error|Internal Server Error/);
  expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}
test.describe("disposable profile self-service and review integration", () => {
  test.skip(!enabled, "Use the isolated profile QA runner; never hosted credentials.");
  test.setTimeout(300_000);
  test("password unlock, direct saves, identity approval, and stale legacy decisions", async ({ page, context, browser }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    // Reproduce the reported unavailable challenge. Signed-in password flows
    // must work even with the provider script blocked; public Auth stays protected.
    await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", route => route.abort("blockedbyclient"));
    const member = await signedIn(context, "profile");
    const adminContext = await browser.newContext();
    try {
      await signedIn(adminContext, "never");
      const adminPage = await adminContext.newPage(); adminPage.on("pageerror", error => errors.push(error.message));
      await fixture("workplace_request", { organization: "Initial Requested Workplace" });
      for (const width of [360, 768, 1440]) for (const theme of ["light", "dark"]) {
        console.info(`Checking fictional workplace review: ${width}px ${theme}`);
        await adminPage.setViewportSize({ width, height: 900 });
        await adminPage.addInitScript(value => localStorage.setItem("jnuits-theme", value), theme);
        const loaded = await adminPage.goto(`${baseURL}/admin/workplace`, { waitUntil: "networkidle" });
        await expect(adminPage.locator("html")).toHaveAttribute("data-theme", theme);
        const review = adminPage.getByRole("button", { name: "Review Synthetic Profile Alumni's workplace request", exact: true }).first();
        try {
          await review.focus();
          await adminPage.keyboard.press("Enter");
        } catch (error) {
          // Failure-only, read-only diagnostics. Never dump cookies, input
          // values, page HTML, account credentials or native MFA material.
          try {
            const state = await fixture("profile_state");
            console.info("Synthetic workplace review failure", JSON.stringify({
              width, theme, status: loaded?.status(), path: new URL(adminPage.url()).pathname,
              reviewControls: await review.count(),
              syntheticMemberVisible: await adminPage.getByText("Synthetic Profile Alumni", { exact: true }).count(),
              pendingFixtureRequests: state.requests.filter((item: { status: string }) => item.status === "pending").length,
            }));
          } catch { console.info("Synthetic workplace failure diagnostics unavailable."); }
          throw error;
        }
        await expect(adminPage.getByRole("button", { name: "Approve", exact: true }).first()).toBeVisible();
        await expect(adminPage.getByRole("button", { name: "Reject", exact: true }).first()).toBeVisible();
        await expect(adminPage.locator("body")).toContainText("Initial Requested Workplace");
        await healthy(adminPage);
        await adminPage.getByRole("button", { name: "Approve", exact: true }).first().scrollIntoViewIfNeeded();
        await adminPage.screenshot({ path: `${process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS}/workplace-review-${width}-${theme}.png`, fullPage: false, timeout: 15_000 });
      }
      await adminPage.getByLabel("Review note", { exact: true }).fill("Synthetic workplace review.");
      await adminPage.getByRole("button", { name: "Approve", exact: true }).first().click();
      await expect.poll(async () => (await fixture("profile_state")).organization).toBe("Initial Requested Workplace");

      const headers = { Origin: baseURL, "Sec-Fetch-Site": "same-origin" };
      const locked = await context.request.post(`${baseURL}/api/profile/direct`, { headers, data: { phone: "01700000001" } });
      expect(locked.status()).toBe(403);
      await page.goto(`${baseURL}/portal/profile/edit`, { waitUntil: "networkidle" });
      await expect(page.locator("#direct-profile-edit-form")).toHaveCount(0);
      await expect(page.locator('[name="captchaToken"]')).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Verify and unlock" })).toBeEnabled();
      await page.getByLabel("Current password", { exact: true }).fill("Incorrect-fixture-password");
      await page.getByRole("button", { name: "Verify and unlock" }).click();
      await expect(page.locator(".portal-message--error")).toBeVisible();
      await page.getByLabel("Current password", { exact: true }).fill(member.password);
      const unlockResponse = page.waitForResponse(response => response.url().endsWith("/api/profile/step-up") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Verify and unlock" }).click();
      expect((await unlockResponse).status()).toBe(200);
      const unlockCookie = (await context.cookies()).find(cookie => cookie.name === "jnuits-step-up");
      expect(Boolean(unlockCookie)).toBe(true);
      expect(Boolean(unlockCookie?.value.startsWith(`${member.userId}.`))).toBe(true);
      await expect(page.locator("#direct-profile-edit-form")).toBeVisible({ timeout: 25_000 });
      await fixture("workplace_request", { organization: "Obsolete Workplace" });
      for (const width of [360, 768, 1440]) for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(value => localStorage.setItem("jnuits-theme", value), theme);
        await page.reload({ waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator("#direct-profile-edit-form")).toBeVisible({ timeout: 25_000 });
        await expect(page.locator("#direct-profile-edit-form").getByLabel("Full name", { exact: true })).toHaveCount(0);
        await page.getByLabel("Current organization", { exact: true }).focus();
        await expect(page.getByLabel("Current organization", { exact: true })).toBeFocused();
        await healthy(page);
        await page.screenshot({ path: `${process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS}/profile-editor-${width}-${theme}.png`, fullPage: false, timeout: 15_000 });
      }
      await page.getByLabel("Current organization", { exact: true }).fill("New Direct Workplace");
      await page.getByLabel("Phone", { exact: true }).fill("");
      const directResponse = page.waitForResponse(response => response.url().endsWith("/api/profile/direct") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Save direct changes" }).click();
      const saved = await directResponse;
      expect(saved.status()).toBe(200);
      expect(saved.request().postDataJSON()).toEqual({ phone: "", currentOrganization: "New Direct Workplace" });
      await expect.poll(async () => (await fixture("profile_state")).organization).toBe("New Direct Workplace");
      expect((await fixture("profile_state")).phone).toBeNull();
      expect(await page.evaluate(async () => (await fetch("/api/profile/direct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "Forbidden Identity" }) })).status)).toBe(400);
      expect(await page.evaluate(async () => (await fetch("/api/portal/workplace-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentOrganization: "Legacy Submission" }) })).status)).toBe(410);
      expect(await fixture("profile_conflict")).toEqual({ code: "PT409", status: 409 });
      await adminPage.goto(`${baseURL}/admin/workplace`, { waitUntil: "networkidle" });
      await adminPage.getByRole("button", { name: "Review Synthetic Profile Alumni's workplace request", exact: true }).first().click();
      const staleResponse = adminPage.waitForResponse(response => response.url().includes("/admin/workplace") && response.request().method() === "POST", { timeout: 45_000 });
      await adminPage.getByRole("button", { name: "Approve", exact: true }).first().click();
      expect((await staleResponse).status()).toBe(200);
      await expect(adminPage.locator('.flash-panel[data-tone="error"]')).toContainText(/newer direct edit/i, { timeout: 25_000 });
      expect((await fixture("profile_state")).organization).toBe("New Direct Workplace");
      await adminPage.getByRole("button", { name: "Reject", exact: true }).first().click();
      await expect.poll(async () => (await fixture("profile_state")).requests.filter((item: { type: string; status: string }) => item.type === "workplace_update" && item.status === "pending").length).toBe(0);

      await page.getByLabel("University student ID", { exact: true }).fill("ST-NEW");
      await page.getByLabel("Batch", { exact: true }).fill("18");
      await page.getByLabel("Graduation year", { exact: true }).fill("2027");
      const identityResponse = page.waitForResponse(response => response.url().endsWith("/api/profile/change-requests") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Submit profile change" }).click();
      const identitySubmitted = await identityResponse;
      expect(identitySubmitted.status()).toBe(201);
      expect(identitySubmitted.request().postDataJSON()).toEqual({ requestType: "profile_change", studentId: "ST-NEW", batchNo: 18, graduationYear: 2027 });
      await expect.poll(async () => (await fixture("profile_state")).requests.filter((item: { type: string; status: string }) => item.type === "profile_change" && item.status === "pending").length).toBe(1);
      expect((await fixture("profile_state")).studentId).toBe("ST-OLD");
      await adminPage.goto(`${baseURL}/admin/profile-changes`, { waitUntil: "networkidle" });
      await expect(adminPage.locator("body")).toContainText("ST-OLD");
      await expect(adminPage.locator("body")).toContainText("ST-NEW");
      await adminPage.getByRole("button", { name: "Approve profile update", exact: true }).click();
      await expect.poll(async () => (await fixture("profile_state")).studentId).toBe("ST-NEW");
      expect(await fixture("profile_state")).toMatchObject({ batch: 18, graduationYear: 2027, organization: "New Direct Workplace" });
      await page.goto(`${baseURL}/portal/profile/change-password`, { waitUntil: "networkidle" });
      await expect(page.locator('[name="captchaToken"]')).toHaveCount(0);
      const nextPassword = `${member.password}-Changed`;
      await page.getByLabel("Current password", { exact: true }).fill("Incorrect-fixture-password");
      await page.getByLabel("New password", { exact: true }).fill(nextPassword);
      await page.getByLabel("Confirm new password", { exact: true }).fill(nextPassword);
      await expect(page.getByRole("button", { name: "Update password", exact: true })).toBeEnabled();
      await page.getByRole("button", { name: "Update password", exact: true }).click();
      const passwordWarning = page.getByRole("dialog", { name: "Change your password?", exact: true });
      await expect(passwordWarning).toContainText("Use your new password the next time you sign in.");
      await passwordWarning.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByLabel("New password", { exact: true })).toHaveValue(nextPassword);
      await page.getByRole("button", { name: "Update password", exact: true }).click();
      await page.getByRole("button", { name: "Confirm password change", exact: true }).click();
      await expect(page.locator(".portal-message--error")).toContainText("Current password is incorrect.");
      // React form actions clear uncontrolled fields after submission. Re-enter
      // the complete request for a real retry after the rejected password.
      await page.getByLabel("Current password", { exact: true }).fill(member.password);
      await page.getByLabel("New password", { exact: true }).fill(nextPassword);
      await page.getByLabel("Confirm new password", { exact: true }).fill(nextPassword);
      const passwordResponse = page.waitForResponse(response => response.url().endsWith("/api/profile/change-password") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Update password", exact: true }).click();
      await page.getByRole("button", { name: "Confirm password change", exact: true }).click();
      expect((await passwordResponse).status()).toBe(200);
      await expect(page.locator(".portal-message--success")).toContainText("Password updated successfully.");
      expect(await fixture("profile_password_state", { password: nextPassword })).toEqual({ newPasswordAccepted: true, oldPasswordRejected: true });
      expect((await context.cookies()).some(cookie => cookie.name === "jnuits-step-up")).toBe(false);
      expect(errors).toEqual([]);
    } finally { await adminContext.close().catch(() => undefined); }
  });
});
