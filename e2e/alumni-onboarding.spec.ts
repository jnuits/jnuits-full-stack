import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
    document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("public alumni onboarding entry", () => {
  test("keeps intake closed with non-enumerating support guidance", async ({ page }) => {
    await page.route("**/api/forms/intake/alumni", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "Form not found." }),
        contentType: "application/json",
        status: 404,
      });
    });

    await page.goto("/alumni-join");
    await expect(
      page.getByRole("heading", { name: "Join the JnUITS alumni community" })
    ).toBeVisible();
    await expect(page.getByText("Alumni onboarding is not open at the moment.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Contact JnUITS" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("opens only the published shared alumni form", async ({ page }) => {
    await page.route("**/api/forms/intake/alumni", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          href: "/forms/alumni-onboarding-2026",
          title: "Alumni onboarding",
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/alumni-join");
    const link = page.getByRole("link", { name: "Open Alumni onboarding" });
    await expect(link).toHaveAttribute("href", "/forms/alumni-onboarding-2026");
  });

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
    { width: 1600, height: 1000 },
  ]) {
    test(`has no overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.route("**/api/forms/intake/alumni", async (route) => {
        await route.fulfill({
          body: JSON.stringify({ error: "Form not found." }),
          contentType: "application/json",
          status: 404,
        });
      });
      await page.goto("/alumni-join");
      await expectNoHorizontalOverflow(page);
    });
  }
});
