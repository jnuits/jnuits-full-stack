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

async function navigateToStablePage(page: Page, path: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await page.goto(path, { waitUntil: "domcontentloaded" });
    } catch (error) {
      const isTransientAbort =
        error instanceof Error &&
        /net::ERR_ABORTED|frame was detached/i.test(error.message);

      if (!isTransientAbort || attempt === 1) {
        throw error;
      }

    }
  }

  throw new Error(`Navigation failed for ${path}.`);
}

async function expectStablePage(page: Page, path: string) {
  const response = await navigateToStablePage(page, path);

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

  for (const viewport of responsiveViewports) {
    for (const route of ["/members", "/gallery", "/events"]) {
      test(`${viewport.label} ${route} renders responsively`, async ({ page }) => {
        await page.setViewportSize({
          height: viewport.height,
          width: viewport.width,
        });
        await expectStablePage(page, route);
      });
    }
  }

  test("membership form route loads without submitting data", async ({ page }) => {
    await expectStablePage(page, "/membership-form");
    await expect(page.locator("body")).toContainText(/membership/i);
  });
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
    test(`public route ${route} loads without runtime errors`, async ({ page }) => {
      await expectStablePage(page, route);
    });
  }


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

  test("admin invitation acceptance uses portal sign-in before an admin role exists", async ({ page }) => {
    await page.goto("/admin/invite/accept", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/portal\/login\?next=%2Fadmin%2Finvite%2Faccept/);
    await expect(page.locator("body")).toContainText(/portal/i);
    await expectNoRuntimeError(page);
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

const festEventRoutes = [
  {
    deadline: "2026-08-15T17:59:00Z",
    slug: "ai-it-olympiad",
    title: "AI & IT Olympiad",
  },
  {
    deadline: "2026-08-15T17:59:00Z",
    slug: "techuncut",
    title: "TechUncut",
  },
  {
    deadline: "2026-08-15T17:59:00Z",
    slug: "techcare-zone",
    title: "TechCare Zone",
  },
  {
    deadline: "2026-08-15T17:59:00Z",
    slug: "ai-ad-venture",
    title: "AI Ad-Venture",
  },
  {
    deadline: "2026-08-20T17:59:59Z",
    slug: "brainchild-season-2-0",
    title: "BrainChild Season 2.0",
  },
];

test.describe("published AI and IT Fest campaign", () => {
  test.skip(
    process.env.PLAYWRIGHT_EXPECT_FEST_CAMPAIGN !== "1",
    "Requires the verified production drafts to be published after the lifecycle fix deploys."
  );

  for (const viewport of responsiveViewports) {
    test(`${viewport.label} homepage keeps four cards and one core BrainChild feature`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      await page.setViewportSize({
        height: viewport.height,
        width: viewport.width,
      });
      await expectStablePage(page, "/");

      const campaign = page.getByRole("region", {
        name: "JnU AI & IT Fest 2026",
      });
      await expect(campaign).toBeVisible();
      await expect(
        campaign.getByRole("heading", {
          level: 1,
          name: "JnU AI & IT Fest 2026",
        })
      ).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

      const showcase = campaign.getByRole("region", {
        name: "Fest event showcase",
      });
      await expect(showcase.getByRole("article")).toHaveCount(4);
      await expect(
        campaign.getByRole("region", { name: "BrainChild core event" })
      ).toHaveCount(1);
      await expect(
        campaign.getByRole("heading", { name: "BrainChild Season 2.0" })
      ).toHaveCount(1);
      await expect(
        campaign.getByText(/Jagannath University IT Society/i)
      ).toBeVisible();

      await expect(
        campaign.getByRole("link", { name: /Explore the Fest/i })
      ).toHaveAttribute("href", "https://itfest.jnuits.org.bd/");
      await expect(
        campaign.getByRole("link", { name: "Register for BrainChild" })
      ).toHaveAttribute("href", "https://brainchild.jnuits.org.bd/register");
      await expect(
        campaign.getByRole("link", { name: "Track registration" })
      ).toHaveAttribute("href", "https://brainchild.jnuits.org.bd/track");

      const imagesLoaded = await campaign.getByRole("img").evaluateAll((images) =>
        images.every(
          (image) => image instanceof HTMLImageElement && image.naturalWidth > 0
        )
      );
      expect(imagesLoaded, "campaign image loading").toBe(true);

      const primaryAction = campaign.getByRole("link", {
        name: /Explore the Fest/i,
      });
      await primaryAction.focus();
      await expect(primaryAction).toBeFocused();
      await expectNoHorizontalOverflow(page);
      expect(consoleErrors, "campaign console errors").toEqual([]);
    });
  }

  for (const event of festEventRoutes) {
    test(`${event.slug} uses its canonical cover and deadline-aware CTA`, async ({
      page,
    }) => {
      await expectStablePage(page, `/events/${event.slug}`);
      await expect(
        page.getByRole("heading", { level: 1, name: event.title })
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: new RegExp(event.title, "i") })
      ).toBeVisible();

      const externalRegistration = page.getByRole("link", {
        name: "Register externally",
      });
      if (Date.now() >= Date.parse(event.deadline)) {
        await expect(externalRegistration).toHaveCount(0);
      } else {
        await expect(externalRegistration).toBeVisible();
      }
    });
  }
});
