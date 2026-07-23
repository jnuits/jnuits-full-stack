import { expect, test, type Page } from "@playwright/test";

type AuthSmokeAccount = {
  email: string | undefined;
  emailSelector: string;
  expectedDashboard: RegExp;
  isAdmin: boolean;
  loginPath: string;
  name: string;
  password: string | undefined;
  passwordSelector: string;
  submitName: string;
};

type AdminSignInOutcome = "mfa" | "workspace";
const enabled = process.env.E2E_AUTH_SMOKE === "1";
const accounts = {
  alumni: { email: process.env.E2E_ALUMNI_MEMBER_EMAIL, emailSelector: "#portal-login-email", expectedDashboard: /\/portal(?:\/dashboard)?(?:\?|$)/, isAdmin: false, loginPath: "/portal/login", name: "alumni member", password: process.env.E2E_ALUMNI_MEMBER_PASSWORD, passwordSelector: "#portal-login-password", submitName: "Sign in to portal" },
  contentAdmin: { email: process.env.E2E_CONTENT_ADMIN_EMAIL, emailSelector: "#admin-login-email", expectedDashboard: /\/admin(?:\/dashboard)?(?:\?|$)/, isAdmin: true, loginPath: "/admin/login", name: "content admin", password: process.env.E2E_CONTENT_ADMIN_PASSWORD, passwordSelector: "#admin-login-password", submitName: "Sign in to admin" },
  currentMember: { email: process.env.E2E_CURRENT_MEMBER_EMAIL, emailSelector: "#portal-login-email", expectedDashboard: /\/portal(?:\/dashboard)?(?:\?|$)/, isAdmin: false, loginPath: "/portal/login", name: "current member", password: process.env.E2E_CURRENT_MEMBER_PASSWORD, passwordSelector: "#portal-login-password", submitName: "Sign in to portal" },
  normalAdmin: { email: process.env.E2E_NORMAL_ADMIN_EMAIL, emailSelector: "#admin-login-email", expectedDashboard: /\/admin(?:\/dashboard)?(?:\?|$)/, isAdmin: true, loginPath: "/admin/login", name: "normal admin", password: process.env.E2E_NORMAL_ADMIN_PASSWORD, passwordSelector: "#admin-login-password", submitName: "Sign in to admin" },
} satisfies Record<string, AuthSmokeAccount>;

async function expectNoRuntimeError(page: Page) {
  await expect(page.locator("body")).not.toContainText(/Runtime Error|Internal Server Error|Application error/i);
}
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - document.documentElement.clientWidth);
  expect(overflow, "page-level horizontal overflow").toBeLessThanOrEqual(2);
}
function requireAccountCredentials(account: AuthSmokeAccount) {
  if (!account.email || !account.password) throw new Error(`Missing E2E credentials for ${account.name}. Set the documented E2E_* environment variables.`);
  return { email: account.email, password: account.password };
}
function isMfaRoute(pathname: string) { return pathname === "/admin/mfa/setup" || pathname === "/admin/mfa/challenge"; }
async function signIn(page: Page, account: AuthSmokeAccount): Promise<AdminSignInOutcome> {
  const credentials = requireAccountCredentials(account);
  await page.goto(account.loginPath, { waitUntil: "domcontentloaded" });
  await expect(page.locator('input[name="captchaToken"]')).toHaveCount(0);
  await page.locator(account.emailSelector).fill(credentials.email);
  await page.locator(account.passwordSelector).fill(credentials.password);
  await page.getByRole("button", { name: account.submitName }).click();
  await page.waitForURL((url) => account.expectedDashboard.test(`${url.pathname}${url.search}`) || (account.isAdmin && isMfaRoute(url.pathname)), { timeout: 30_000 });
  await expectNoRuntimeError(page);
  return account.isAdmin && isMfaRoute(new URL(page.url()).pathname) ? "mfa" : "workspace";
}
async function expectProtectedRoute(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${route} status`).toBeLessThan(500);
  await expect(page).not.toHaveURL(/\/(admin|portal)\/login|\/admin\/access-pending/);
  await expectNoRuntimeError(page);
  await expectNoHorizontalOverflow(page);
}
async function expectAdminWorkspaceOrMfa(page: Page, account: AuthSmokeAccount, routes: string[]) {
  const outcome = await signIn(page, account);
  if (outcome === "mfa") { await expect(page.locator("body")).toContainText(/MFA|authenticator/i); return; }
  for (const route of routes) await expectProtectedRoute(page, route);
}

test.describe("optional authenticated workflow smoke", () => {
  test.skip(!enabled, "Set E2E_AUTH_SMOKE=1 with non-production credentials to run authenticated checks.");

  test("normal admin reaches core operations or MFA onboarding", async ({ page }) => {
    await expectAdminWorkspaceOrMfa(page, accounts.normalAdmin, ["/admin", "/admin/invitations", "/admin/membership", "/admin/certificates", "/admin/settings/notifications", "/admin/settings/security", "/admin/admin-profiles"]);
  });

  test("content admin reaches content workflows and Form Studio or MFA onboarding", async ({ page }) => {
    await expectAdminWorkspaceOrMfa(page, accounts.contentAdmin, ["/admin", "/admin/content/blogs", "/admin/content/notices", "/admin/content/events", "/admin/content/forms", "/admin/content/gallery"]);
  });

  test("content admin cannot create membership forms through the API", async ({ page }) => {
    const outcome = await signIn(page, accounts.contentAdmin);
    if (outcome === "mfa") { await expect(page.locator("body")).toContainText(/MFA|authenticator/i); return; }
    const response = await page.request.post("/api/admin/forms", {
      data: {
        applicationBehavior: { fieldMapping: { email: "email", fullName: "full_name" } },
        definition: { fields: [{ id: "full_name", label: "Full name", required: true, type: "text" }, { id: "email", label: "Email", required: true, type: "email" }], payment: { enabled: false } },
        kind: "membership_application",
        slug: "forbidden-content-admin-membership",
        title: "Forbidden membership form",
      },
    });
    expect(response.status()).toBe(403);
  });

  test("Form Studio has no page overflow at required viewports", async ({ page }) => {
    const outcome = await signIn(page, accounts.normalAdmin);
    if (outcome === "mfa") { await expect(page.locator("body")).toContainText(/MFA|authenticator/i); return; }
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1280, height: 900 },
      { width: 1600, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/admin/content/forms", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Form Studio" })).toBeVisible();
      await expectNoRuntimeError(page);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("current member reaches portal workflows", async ({ page }) => {
    await signIn(page, accounts.currentMember);
    for (const route of ["/portal/dashboard", "/portal/profile", "/portal/blogs", "/portal/projects", "/portal/tickets", "/portal/mentorship", "/portal/activity"]) await expectProtectedRoute(page, route);
  });

  test("alumni member reaches portal workflows", async ({ page }) => {
    await signIn(page, accounts.alumni);
    for (const route of ["/portal/dashboard", "/portal/profile", "/portal/blogs", "/portal/projects", "/portal/tickets", "/portal/mentorship", "/portal/activity"]) await expectProtectedRoute(page, route);
  });
});
