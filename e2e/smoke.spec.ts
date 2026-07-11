import { expect, test, type Page } from "@playwright/test";

const securityHeaderExpectations = {
  "content-security-policy": /default-src 'self'/,
  "referrer-policy": /strict-origin-when-cross-origin/,
  "x-content-type-options": /nosniff/,
  "x-frame-options": /SAMEORIGIN/,
};

const responsiveViewports = [
  { height: 900, label: "desktop", width: 1280 },
  { height: 1024, label: "tablet", width: 768 },
  { height: 812, label: "mobile", width: 375 },
];

async function expectNoRuntimeError(page: Page) {
  const body = page.locator("body");
  await expect(body).not.toContainText(/Runtime Error|Internal Server Error|Application error/i);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body?.scrollWidth || 0) - root.clientWidth;
  });

  expect(overflow, "page-level horizontal overflow").toBeLessThanOrEqual(2);
}

async function expectStablePage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });

  expect(response?.status(), `${path} status`).toBeLessThan(500);
  await expect(page.locator("body")).toContainText(/JnUITS|Members|Gallery|Events|Email/i);
  await expectNoRuntimeError(page);
  await expectNoHorizontalOverflow(page);
}

test.describe("public and auth smoke", () => {
  test("homepage renders with security headers", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    const headers = response?.headers() || {};
    expect(headers["x-powered-by"]).toBeUndefined();
    for (const [name, expected] of Object.entries(securityHeaderExpectations)) {
      expect(headers[name], `${name} header`).toMatch(expected);
    }
    if (!process.env.PLAYWRIGHT_BASE_URL) {
      expect(headers["content-security-policy"]).not.toContain("'unsafe-eval'");
    }

    await expect(page.locator("body")).toContainText("JnUITS");
    await expectNoRuntimeError(page);
    await expectNoHorizontalOverflow(page);
  });

  test("public archive routes render responsively", async ({ page }) => {
    for (const viewport of responsiveViewports) {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      for (const route of ["/members", "/gallery", "/events"]) {
        await expectStablePage(page, route);
      }
    }
  });

  test("membership form route loads without submitting data", async ({ page }) => {
    await expectStablePage(page, "/membership-form");
    await expect(page.locator("body")).toContainText(/membership/i);
  });
  test("public core routes load without runtime errors", async ({ page }) => {
    for (const route of [
      "/about",
      "/alumni",
      "/blogs",
      "/certificates",
      "/committee",
      "/contact",
      "/notices",
      "/projects",
    ]) {
      await expectStablePage(page, route);
    }
  });


  test("admin and portal login pages render accessible fields responsively", async ({ page }) => {
    for (const viewport of responsiveViewports) {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });

      await expectStablePage(page, "/admin/login");
      await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();

      await expectStablePage(page, "/portal/login");
      await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
    }
  });

  test("unauthenticated admin routes redirect to admin login", async ({ page }) => {
    for (const route of [
      "/admin/dashboard",
      "/admin/reports",
      "/admin/settings/notifications",
      "/admin/settings/security",
      "/admin/system-health",
    ]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/admin\/login/);
      await expect(page.locator("body")).toContainText(/admin/i);
      await expectNoRuntimeError(page);
    }
  });

  test("keyboard navigation reaches public controls and login fields", async ({ page }) => {
    await page.goto("/");

    const firstFocusable = page.locator("a, button, input, select, textarea").first();
    await firstFocusable.focus();
    await expect(firstFocusable).toBeFocused();

    const membersMenu = page.getByRole("button", { name: /^Members$/ }).first();
    if ((await membersMenu.count()) > 0 && (await membersMenu.isVisible())) {
      await membersMenu.focus();
      await page.waitForTimeout(250);
      await page.keyboard.press("Enter");
      await expect(membersMenu).toHaveAttribute("aria-expanded", "true");
    }

    const nextSlide = page.getByRole("button", { name: /next slide/i }).first();
    if ((await nextSlide.count()) > 0 && (await nextSlide.isVisible())) {
      await nextSlide.focus();
      await expect(nextSlide).toBeFocused();
    }

    await page.goto("/admin/login");
    await page.getByRole("textbox", { name: /email/i }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/password/i)).toBeFocused();

    await page.goto("/portal/login");
    await page.getByRole("textbox", { name: /email/i }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/password/i)).toBeFocused();
  });
});

