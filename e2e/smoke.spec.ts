import { expect, test } from "@playwright/test";

const securityHeaderExpectations = {
  "content-security-policy": /default-src 'self'/,
  "referrer-policy": /strict-origin-when-cross-origin/,
  "x-content-type-options": /nosniff/,
  "x-frame-options": /SAMEORIGIN/,
};

test.describe("public and auth smoke", () => {
  test("homepage renders with security headers", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    const headers = response?.headers() || {};
    expect(headers["x-powered-by"]).toBeUndefined();
    for (const [name, expected] of Object.entries(securityHeaderExpectations)) {
      expect(headers[name], `${name} header`).toMatch(expected);
    }

    await expect(page.locator("body")).toContainText("JnUITS");
    await expect(page.locator("body")).not.toContainText("Runtime Error");
  });

  test("membership form route loads without submitting data", async ({ page }) => {
    await page.goto("/membership-form");

    await expect(page.locator("body")).toContainText(/membership/i);
    await expect(page.locator("body")).not.toContainText("Runtime Error");
  });

  test("admin and portal login pages render accessible email fields", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    await page.goto("/portal/login");
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("unauthenticated admin routes redirect to admin login", async ({ page }) => {
    await page.goto("/admin/dashboard");

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator("body")).toContainText(/admin/i);
  });

  test("keyboard navigation can reach a primary public link", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(["a", "button", "input", "select", "textarea"].includes(activeTag || "")).toBe(true);
  });
});