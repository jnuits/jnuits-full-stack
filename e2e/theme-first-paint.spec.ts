import { expect, test } from "@playwright/test";
import { installFixtureTelemetry } from "./fixtures/telemetry";

test.beforeEach(async ({ context, baseURL }) => {
  await installFixtureTelemetry(context, { baseURL, dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
});

test.describe("Theme first-paint FOIT elimination and CSP resilience", () => {
  test("production HTML contains nonced ThemeInitScript matching CSP nonce with zero unnonced scripts", async ({ request }) => {
    const response = await request.get("/", { headers: { accept: "text/html" } });
    expect(response.status()).toBe(200);

    const csp = response.headers()["content-security-policy"];
    expect(csp).toBeTruthy();
    const nonceMatch = csp.match(/'nonce-([^']+)'/);
    expect(nonceMatch).toBeTruthy();
    const responseNonce = nonceMatch![1];

    const scriptSrcDirective = csp.split(";").find(dir => dir.trim().startsWith("script-src"))!;
    expect(scriptSrcDirective).toContain("'strict-dynamic'");
    expect(scriptSrcDirective).not.toMatch(/unsafe-inline|unsafe-eval/);

    const html = await response.text();
    // Verify script tag with nonce is present in <head>
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    expect(headMatch).toBeTruthy();
    const headContent = headMatch![1];

    expect(headContent).toContain(`nonce="${responseNonce}"`);
    expect(headContent).toContain("jnuits-theme");
    expect(headContent).toContain("data-theme");

    // Verify no unnonced inline script exists anywhere in HTML
    const inlineScriptRegex = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = inlineScriptRegex.exec(html)) !== null) {
      const attributes = match[1];
      const scriptType = attributes.match(/type=["']([^"']+)["']/i)?.[1];
      // JSON data scripts (e.g. application/json or ld+json) don't require nonces, JS executable scripts do
      if (!scriptType || scriptType === "text/javascript" || scriptType === "module") {
        expect(attributes).toContain(`nonce="${responseNonce}"`);
      }
    }
  });

  test("stored dark theme applies before first paint and survives delayed hydration without light flash", async ({ page, baseURL }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Install instrumentation prior to navigation
    await page.addInitScript(() => {
      // 1. Pre-seed stored dark theme (simulating returning dark mode visitor)
      try {
        window.localStorage.setItem("jnuits-theme", "dark");
      } catch {}

      // 2. Track CSP violations
      (window as unknown as { cspViolations: string[] }).cspViolations = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        (window as unknown as { cspViolations: string[] }).cspViolations.push(
          `${e.effectiveDirective}:${e.blockedURI}`
        );
      });

      // 3. Track every theme mutation on <html> from the earliest script execution
      (window as unknown as { themeHistory: Array<{ theme: string | null; hasDark: boolean; timestamp: number }> }).themeHistory = [];
      const record = () => {
        const root = document.documentElement;
        if (root) {
          (window as unknown as { themeHistory: Array<{ theme: string | null; hasDark: boolean; timestamp: number }> }).themeHistory.push({
            theme: root.getAttribute("data-theme"),
            hasDark: root.classList.contains("dark"),
            timestamp: performance.now(),
          });
        }
      };
      new MutationObserver(record).observe(document, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });

    });

    // Artificially delay client JS chunks by 300ms to guarantee an observable pre-hydration window
    await page.route("**/_next/static/chunks/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });

    // Navigate to homepage with domcontentloaded wait
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    // At DOMContentLoaded (before delayed client chunks finish executing):
    // documentElement must ALREADY be dark!
    const preHydrationTheme = await page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute("data-theme"),
      hasDarkClass: document.documentElement.classList.contains("dark"),
      history: (window as unknown as { themeHistory: any[] }).themeHistory,
    }));

    expect(preHydrationTheme.dataTheme).toBe("dark");
    expect(preHydrationTheme.hasDarkClass).toBe(true);

    // Wait for full hydration (theme toggle button interactive)
    const toggleButton = page.getByRole("button", { name: "Toggle color theme", exact: true });
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");

    // Post-hydration assertions
    const postHydrationState = await page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute("data-theme"),
      hasDarkClass: document.documentElement.classList.contains("dark"),
      history: (window as unknown as { themeHistory: any[] }).themeHistory,
      cspViolations: (window as unknown as { cspViolations: string[] }).cspViolations,
    }));

    expect(postHydrationState.dataTheme).toBe("dark");
    expect(postHydrationState.hasDarkClass).toBe(true);
    expect(postHydrationState.cspViolations).toEqual([]);
    expect(pageErrors).toEqual([]);

    // Verify that data-theme was NEVER reset to "light" at any point during or after hydration
    for (const entry of postHydrationState.history) {
      if (entry.theme !== null) {
        expect(entry.theme).not.toBe("light");
      }
    }
  });

  test("stored light theme applies before first paint and stays light", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("jnuits-theme", "light");
      } catch {}
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const themeState = await page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute("data-theme"),
      hasDarkClass: document.documentElement.classList.contains("dark"),
    }));

    expect(themeState.dataTheme).toBe("light");
    expect(themeState.hasDarkClass).toBe(false);

    const toggleButton = page.getByRole("button", { name: "Toggle color theme", exact: true });
    await expect(toggleButton).toHaveAttribute("aria-pressed", "false");
  });

  test("falls back to system dark theme before first paint when no preference is stored", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {}
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const themeState = await page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute("data-theme"),
      hasDarkClass: document.documentElement.classList.contains("dark"),
    }));

    expect(themeState.dataTheme).toBe("dark");
    expect(themeState.hasDarkClass).toBe(true);

    const toggleButton = page.getByRole("button", { name: "Toggle color theme", exact: true });
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");
  });

  test("gracefully falls back to system theme when storage access is denied (throwing SecurityError)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
        configurable: true,
      });
    });

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Should fall back to system dark
    const themeState = await page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute("data-theme"),
      hasDarkClass: document.documentElement.classList.contains("dark"),
    }));

    expect(themeState.dataTheme).toBe("dark");
    expect(themeState.hasDarkClass).toBe(true);

    // Toggle button should still be clickable and function via in-memory state
    const toggleButton = page.getByRole("button", { name: "Toggle color theme", exact: true });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("light");
    expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false);

    // No unhandled page errors thrown
    expect(pageErrors).toEqual([]);
  });

  test("interactive toggle switches theme, persists to storage, and survives client navigation", async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      try {
        if (!window.localStorage.getItem("jnuits-theme")) {
          window.localStorage.setItem("jnuits-theme", "light");
        }
      } catch {}
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const toggleButton = page.getByRole("button", { name: "Toggle color theme", exact: true });
    await expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    // Click toggle
    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("dark");
    expect(await page.evaluate(() => window.localStorage.getItem("jnuits-theme"))).toBe("dark");

    // Client navigate to /about
    const menuButton = page.getByRole("button", { name: "Open navigation menu", exact: true });
    const mobileMenu = await menuButton.isVisible();
    if (mobileMenu) await menuButton.click();
    const navigation = page.getByRole("navigation", {
      name: mobileMenu ? "Mobile navigation" : "Primary navigation",
      exact: true,
    });
    await navigation.locator('a[href="/about"]').click();
    await expect(page).toHaveURL(/\/about/, { timeout: 20000 });

    // Theme remains dark on client navigation
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("dark");
    expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
  });
});
