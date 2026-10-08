import { expect, test, type Page } from "@playwright/test";
import { installFixtureTelemetry } from "./fixtures/telemetry";

interface ThemeState {
  time: number;
  theme: string | null;
  dark: boolean;
  background: string;
}
interface ThemeProbe {
  frames: ThemeState[];
  transitions: Array<{ previous: string | null; current: string | null }>;
  paints: Array<{ name: string; time: number }>;
  paintSupported: boolean;
  violations: string[];
}
declare global {
  interface Window {
    themeProbe: ThemeProbe;
    themeNavigationMarker?: boolean;
  }
}

test.beforeEach(async ({ context, baseURL }) => {
  await installFixtureTelemetry(context, { baseURL, dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
});

async function holdClientScripts(page: Page) {
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let blocked = 0;
  await page.route("**/_next/static/**", async route => {
    if (route.request().resourceType() === "script") {
      blocked++;
      await gate;
    }
    await route.continue();
  });
  return { release, blocked: () => blocked };
}

async function captureHeldDocument(page: Page) {
  // WebKit's fonts.ready can depend on document load, which is deliberately
  // held by this fixture. Capture the rendered page without releasing chunks.
  const previous = process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY;
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";
  try {
    return await page.screenshot();
  } finally {
    if (previous === undefined) delete process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY;
    else process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = previous;
  }
}

async function instrument(page: Page, preference: string | null, denied = false) {
  await page.addInitScript(({ preference, denied }) => {
    // Child about:blank frames can inherit storage; they must not reseed a
    // visitor preference or reset instrumentation in the main document.
    if (window !== window.top) return;
    if (denied) {
      Object.defineProperty(window, "localStorage", {
        get() { throw new DOMException("Storage denied", "SecurityError"); },
        configurable: true,
      });
    } else if (preference === null) {
      localStorage.removeItem("jnuits-theme");
    } else {
      localStorage.setItem("jnuits-theme", preference);
    }
    const probe: ThemeProbe = window.themeProbe = {
      frames: [], transitions: [], paints: [],
      paintSupported: typeof PerformanceObserver !== "undefined" &&
        PerformanceObserver.supportedEntryTypes.includes("paint"),
      violations: [],
    };
    document.addEventListener("securitypolicyviolation", event => {
      probe.violations.push(event.effectiveDirective + ":" + event.blockedURI);
    });
    const contentVisible = () => {
      const main = document.querySelector("main");
      return Boolean(main && main.getBoundingClientRect().height > 0);
    };
    const frame = () => {
      if (contentVisible()) {
        probe.frames.push({
          time: performance.now(),
          theme: document.documentElement.getAttribute("data-theme"),
          dark: document.documentElement.classList.contains("dark"),
          background: getComputedStyle(document.body).backgroundColor,
        });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    new MutationObserver(records => {
      if (!contentVisible()) return;
      // oldValue retains intermediate values even when React changes an
      // attribute twice in one task and observers see only the final DOM.
      for (const record of records) {
        if (record.attributeName === "data-theme") {
          probe.transitions.push({
            previous: record.oldValue,
            current: document.documentElement.getAttribute("data-theme"),
          });
        }
      }
    }).observe(document, {
      subtree: true, attributes: true, attributeOldValue: true,
      attributeFilter: ["data-theme"],
    });
    if (probe.paintSupported) {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          probe.paints.push({ name: entry.name, time: entry.startTime });
        }
      }).observe({ type: "paint", buffered: true });
    }
  }, { preference, denied });
}

test("production head bootstrap and executable scripts share the strict response nonce", async ({ request }) => {
  const response = await request.get("/", { headers: { accept: "text/html" } });
  expect(response.status()).toBe(200);
  const csp = response.headers()["content-security-policy"];
  const nonce = csp?.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  const scripts = csp.split(";").find(value => value.trim().startsWith("script-src"));
  expect(scripts).toContain("'strict-dynamic'");
  expect(scripts).not.toMatch(/unsafe-inline|unsafe-eval/);
  const html = await response.text();
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  expect(head).toContain('id="jnuits-theme-init"');
  const bootstrap = head?.match(/<script([^>]*)id="jnuits-theme-init"([^>]*)>/)?.[0];
  expect(bootstrap).toContain(`nonce="${nonce}"`);
  for (const script of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const type = script[1].match(/type=["']([^"']+)["']/i)?.[1];
    if (!type || type === "text/javascript" || type === "module") {
      expect(script[1]).toContain(`nonce="${nonce}"`);
    }
  }
});

const cases = [
  { name: "stored dark overrides system light", preference: "dark", system: "light", expected: "dark" },
  { name: "stored light overrides system dark", preference: "light", system: "dark", expected: "light" },
  { name: "system dark without storage", preference: null, system: "dark", expected: "dark" },
  { name: "system light without storage", preference: null, system: "light", expected: "light" },
  { name: "invalid stored value uses system dark", preference: "invalid", system: "dark", expected: "dark" },
  { name: "denied storage uses system dark", preference: null, system: "dark", expected: "dark", denied: true },
] as const;

for (const scenario of cases) {
  test(`visible frames use ${scenario.name} while hydration is held and after release`, async ({ page, browserName }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.emulateMedia({ colorScheme: scenario.system });
    await instrument(page, scenario.preference, "denied" in scenario);
    const chunks = await holdClientScripts(page);
    let pre: ThemeProbe;
    try {
      const response = await page.goto("/", { waitUntil: "commit" });
      expect(response?.status()).toBe(200);
      await page.waitForFunction(() => window.themeProbe.frames.length >= 3);
      await expect.poll(chunks.blocked).toBeGreaterThan(0);
      pre = await page.evaluate(() => window.themeProbe);
      expect(pre.frames.every(frame => frame.theme === scenario.expected &&
        frame.dark === (scenario.expected === "dark"))).toBe(true);
      if (pre.paintSupported && browserName === "chromium") {
        await page.waitForFunction(() => window.themeProbe.paints.some(entry => entry.name === "first-contentful-paint"));
        pre = await page.evaluate(() => window.themeProbe);
      }
      const fcp = pre.paints.find(entry => entry.name === "first-contentful-paint");
      if (fcp) {
        expect(pre.frames.some(frame => frame.time <= fcp.time)).toBe(true);
      } else {
        testInfo.annotations.push({ type: "paint-api-limitation",
          description: pre.paintSupported
            ? "Engine advertises Paint Timing but no FCP entry was observable while client scripts were held; retained visible frames and screenshot."
            : "Paint Timing unavailable; retained visible frames and screenshot while client scripts were held." });
      }
      await testInfo.attach("before-hydration", { body: await captureHeldDocument(page), contentType: "image/png" });
      await testInfo.attach("pre-hydration-frames", {
        body: JSON.stringify({ blockedClientScripts: chunks.blocked(), ...pre }), contentType: "application/json",
      });
    } finally {
      chunks.release();
    }
    await page.waitForLoadState("load");
    const button = page.getByRole("button", { name: "Toggle color theme", exact: true });
    await expect(button).toHaveAttribute("aria-pressed", String(scenario.expected === "dark"));
    const post = await page.evaluate(() => window.themeProbe);
    expect(post.frames.every(frame => frame.theme === scenario.expected &&
      frame.dark === (scenario.expected === "dark"))).toBe(true);
    expect(post.transitions.every(change => change.previous === scenario.expected &&
      change.current === scenario.expected)).toBe(true);
    expect(post.violations).toEqual([]);
    expect(errors).toEqual([]);
    await testInfo.attach("after-hydration", { body: await page.screenshot(), contentType: "image/png" });
    await testInfo.attach("hydration-receipt", { body: JSON.stringify(post), contentType: "application/json" });

    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", String(scenario.expected !== "dark"));
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(
      scenario.expected === "dark" ? "light" : "dark");
    expect(errors).toEqual([]);
  });
}

test("negative control exposes the server light theme when the bootstrap is removed", async ({ page, baseURL }) => {
  await instrument(page, "dark");
  const chunks = await holdClientScripts(page);
  await page.route(new URL("/", baseURL).href, async route => {
    const response = await route.fetch();
    const body = await response.text();
    const withoutBootstrap = body.replace(/<script[^>]*id="jnuits-theme-init"[^>]*>[\s\S]*?<\/script>/, "");
    expect(withoutBootstrap).not.toBe(body);
    await route.fulfill({ response, body: withoutBootstrap });
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await page.waitForFunction(() => window.themeProbe.frames.length >= 3);
    await expect.poll(chunks.blocked).toBeGreaterThan(0);
    const probe = await page.evaluate(() => window.themeProbe);
    expect(probe.frames.some(frame => frame.theme === "light" && !frame.dark)).toBe(true);
  } finally {
    chunks.release();
  }
});

test("toggle persists across client navigation when writes succeed or throw", async ({ page }) => {
  test.setTimeout(60000);
  await instrument(page, "light");
  await page.goto("/");
  const button = page.getByRole("button", { name: "Toggle color theme", exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("jnuits-theme"))).toBe("dark");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); };
  });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => localStorage.getItem("jnuits-theme"))).toBe("dark");
  await page.evaluate(() => { window.themeNavigationMarker = true; });
  const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
  const mobile = await menu.isVisible();
  if (mobile) await menu.click();
  await page.getByRole("navigation", { name: mobile ? "Mobile navigation" : "Primary navigation", exact: true })
    .locator('a[href="/about"]').click();
  await expect(page).toHaveURL(/\/about/);
  expect(await page.evaluate(() => window.themeNavigationMarker)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  await expect(page.getByRole("button", { name: "Toggle color theme", exact: true })).toHaveAttribute("aria-pressed", "false");
});
