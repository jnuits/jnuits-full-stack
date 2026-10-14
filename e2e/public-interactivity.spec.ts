import { expect, test, type Page, type Response } from "@playwright/test";
import { installFixtureTelemetry } from "./fixtures/telemetry";
import { trackDocumentErrors } from "./fixtures/document-errors";

const providerDiagnostics = new WeakMap<Page, string[]>();
const documentErrors = new WeakMap<Page, ReturnType<typeof trackDocumentErrors>>();

test.beforeEach(async ({ context, page, baseURL }) => {
  providerDiagnostics.set(page, []);
  // This suite is also run against production. No authentication, business
  // submissions, newsletter mail, or certificate lookups may reach the server.
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
        url.origin === new URL(baseURL!).origin &&
        url.pathname !== "/monitoring") {
      await route.abort("blockedbyclient");
      throw new Error("Public smoke attempted a server mutation: " + url.pathname);
    }
    await route.continue();
  });
  // Only the exact dummy DSN on loopback gets a telemetry transport fixture.
  // Actual production requests and application exceptions are never replaced.
  await installFixtureTelemetry(context, { baseURL, dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
  await page.addInitScript(() => {
    const observed = window as unknown as { documentCspViolations: string[] };
    observed.documentCspViolations = [];
    document.addEventListener("securitypolicyviolation", event => {
      const disposition = event.disposition === "report" ? "report" : "enforce";
      observed.documentCspViolations.push(disposition + ":" + event.effectiveDirective + ":" + event.blockedURI);
    });
  });
});

function expectNoBlockedScripts(violations: string[]) {
  expect(violations.filter(value => value.startsWith("enforce:script-src"))).toEqual([]);
}

test.afterEach(async ({ page }, info) => {
  const violations = await page.evaluate(() =>
    (window as unknown as { documentCspViolations?: string[] }).documentCspViolations ?? []
  ).catch(() => []);
  await info.attach("provider-frame-diagnostics", { body: JSON.stringify(providerDiagnostics.get(page) ?? []), contentType: "application/json" });
  await info.attach("retired-document-prefetch-diagnostics", { body: JSON.stringify(documentErrors.get(page)?.retirementDiagnostics ?? []), contentType: "application/json" });
  await info.attach("document-csp-violations", { body: JSON.stringify(violations), contentType: "application/json" });
  // Cloudflare can sample report-only monitoring policies; retain their events
  // as diagnostics. Enforced application/edge script blocking must still fail.
  expectNoBlockedScripts(violations);
});

function trackErrors(page: Page, browserName = "") {
  const tracker = trackDocumentErrors(page, browserName, error => {
    // WebKit reports this provider iframe same-origin denial as a pageerror.
    // Preserve it separately; this public suite does not certify real CAPTCHA.
    if (/^\/challenges\.cloudflare\.com" from accessing a frame with origin "https:\/\/jnuits\.org\.bd"\. Protocols, domains, and ports must match\.$/.test(error.message)) {
      providerDiagnostics.get(page)?.push(error.message);
      return true;
    }
    return false;
  });
  documentErrors.set(page, tracker);
  return tracker.errors;
}

async function expectDocument(response: Response | null) {
  expect(response?.status()).toBe(200);
  expect(response!.headers()["content-type"]).toContain("text/html");
  const html = await response!.text();
  expect(html, "Cloudflare must not rewrite Next.js scripts").not.toMatch(/rocket-loader|data-cf-settings|text\/rocketscript|type=["'][^"']+-text\/javascript/i);
  return html;
}

test("site font families and required weights load from the rendered CSS variables", async ({ page }) => {
  await expectDocument(await page.goto("/certificates"));
  const loaded = await page.evaluate(async () => {
    const styles = getComputedStyle(document.documentElement);
    const fonts = [
      { variable: "--font-sans", weights: [400, 500, 600, 700, 800], text: "JnUITS Society" },
      { variable: "--font-mono", weights: [400, 500, 600], text: "JnUITS-2023001" },
      { variable: "--font-serif", weights: [400, 500, 600, 700], text: "Step Ahead with IT" },
      { variable: "--font-bengali", weights: [400, 700], text: "সদস্য পরিচিতি" },
    ];
    return Promise.all(fonts.map(async ({ variable, weights, text }) => {
      const family = styles.getPropertyValue(variable).split(",")[0].trim();
      const faces = await Promise.all(weights.map(weight => document.fonts.load(`${weight} 16px ${family}`, text)));
      return { variable, defined: Boolean(family), loaded: faces.every((result, index) => result.length > 0 && result.every(face => {
        const range = face.weight.split(/\s+/).map(Number);
        return face.status === "loaded" && range.every(Number.isFinite) && weights[index] >= range[0] && weights[index] <= (range[1] ?? range[0]);
      })) };
    }));
  });
  expect(loaded).toEqual(["--font-sans", "--font-mono", "--font-serif", "--font-bengali"].map(variable => ({ variable, defined: true, loaded: true })));
});

test("nonced HTML disallows intermediary transformations and uses fresh matching nonces", async ({ request }) => {
  const nonces: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request.get("/certificates", { headers: { accept: "text/html" } });
    expect(response.status()).toBe(200);
    const expectedRelease = process.env.PUBLIC_SMOKE_EXPECTED_SHA;
    if (expectedRelease) {
      expect(expectedRelease).toMatch(/^[a-f0-9]{40}$/i);
      expect(response.headers()["x-jnuits-release"], "public domain must serve the expected build").toBe(expectedRelease);
    }
    const cacheControl = response.headers()["cache-control"];
    expect(cacheControl).toContain("no-store");
    expect(cacheControl).toContain("no-transform");
    const csp = response.headers()["content-security-policy"];
    expect(csp).toContain("'strict-dynamic'");
    expect(csp.split(";").find(value => value.trim().startsWith("script-src"))).not.toMatch(/unsafe-inline|unsafe-eval/);
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    const html = await response.text();
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(match => match[0]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts.filter(tag => !/src=/.test(tag) || tag.includes("/_next/"))) {
      expect(script.match(/nonce="([^"]+)"/)?.[1]).toBe(nonce);
    }
    nonces.push(nonce!);
  }
  expect(nonces[0]).not.toBe(nonces[1]);
});

for (const width of [375, 768, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`member directory badges and portraits at ${width}px in ${theme}`, async ({ page, baseURL }, info) => {
      const errors = trackErrors(page);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript(value => localStorage.setItem("jnuits-theme", value), theme);
      await expectDocument(await page.goto("/members"));
      await expect(page.getByRole("heading", { name: "Members & alumni directory", exact: true })).toBeVisible();
      if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
      else await expect(page.locator("html")).not.toHaveClass(/dark/);
      const cards = page.locator(".member-card");
      const syntheticDirectory = process.env.JNUITS_COMMITTEE_BROWSER_FIXTURES === "1"
        && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL!).hostname);
      if (syntheticDirectory) {
        await expect(cards).toHaveCount(3);
        expect(await cards.locator(".member-committee-title").count()).toBeGreaterThan(0);
        await expect(cards.locator("img.member-avatar")).toHaveCount(1);
      } else if (await cards.count() === 0) {
        await expect(page.getByText("No members found", { exact: true })).toBeVisible();
      }
      for (const card of await cards.all()) {
        if (await card.locator(".member-committee-title").count()) {
          await expect(card.getByText("Member", { exact: true })).toHaveCount(0);
          await expect(card.getByText("Alumni", { exact: true })).toHaveCount(0);
        } else {
          await expect(card.getByText(/^(Member|Alumni)$/)).toBeVisible();
        }
        const portrait = card.locator(".member-avatar");
        await expect(portrait).toBeVisible();
        const box = await portrait.boundingBox();
        expect(box?.width).toBeCloseTo(80, 2);
        expect(box?.height).toBeCloseTo(80, 2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await info.attach(`member-directory-${width}-${theme}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      expect(errors).toEqual([]);
    });
  }
}

test("desktop menus expand by click and keyboard and close with Escape", async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expectDocument(await page.goto("/"));
  const nav = page.getByRole("navigation", { name: "Primary navigation", exact: true });
  for (const name of ["Members", "Resources"]) {
    const button = nav.getByRole("button", { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(nav.locator("#" + await button.getAttribute("aria-controls"))).toHaveAttribute("aria-hidden", "false");
    await button.focus();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});

test("mobile hamburger and both submenus work through repeated open and close", async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await expectDocument(await page.goto("/certificates"));
  const toggle = page.locator(".site-mobile-menu-button");
  const nav = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(nav).toBeVisible();
    for (const name of ["Members", "Resources"]) {
      const button = nav.getByRole("button", { name, exact: true });
      if (await button.getAttribute("aria-expanded") === "true") await button.click();
      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "true");
      const panelId = await button.getAttribute("aria-controls");
      await expect(page.locator("[id=" + JSON.stringify(panelId) + "]")).toHaveAttribute("aria-hidden", "false");
    }
    await page.keyboard.press("Escape");
    await expect(nav).not.toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  }
  expect(errors).toEqual([]);
});

test("certificate field and local validation survive client navigation and reload", async ({ page, browserName }) => {
  const errors = trackErrors(page, browserName);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expectDocument(await page.goto("/"));
  await page.evaluate(() => { (window as unknown as { navigationProof: boolean }).navigationProof = true; });
  const nav = page.getByRole("navigation", { name: "Primary navigation", exact: true });
  await nav.getByRole("button", { name: "Resources", exact: true }).click();
  await nav.getByRole("menuitem", { name: /certificates/i }).click();
  await expect(page).toHaveURL(/\/certificates$/);
  expect(await page.evaluate(() => (window as unknown as { navigationProof?: boolean }).navigationProof)).toBe(true);
  const input = page.getByRole("textbox", { name: "Certificate ID", exact: true });
  await expect(input).toBeVisible();
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.locator(".certificate-result-card[role=alert]")).toContainText("Enter a valid certificate ID.");
  // Check the outgoing document's CSP before retirement; the afterEach guard
  // checks the new document. Reload itself must still work immediately.
  expectNoBlockedScripts(await page.evaluate(() =>
    (window as unknown as { documentCspViolations: string[] }).documentCspViolations
  ));
  await expectDocument(await documentErrors.get(page)!.reload());
  await expect(input).toBeVisible();
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.locator(".certificate-result-card[role=alert]")).toBeVisible();
  expect(errors).toEqual([]);
});

test("theme toggle and newsletter input remain interactive without submitting", async ({ page }) => {
  const errors = trackErrors(page);
  await expectDocument(await page.goto("/certificates"));
  const toggle = page.getByRole("button", { name: "Toggle color theme", exact: true });
  await expect(toggle).toBeVisible();
  const initial = await page.locator("html").getAttribute("data-theme");
  await toggle.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", initial!);
  const newsletter = page.locator(".site-footer-newsletter");
  const input = newsletter.getByRole("textbox", { name: /email/i });
  await expect(input).toBeEnabled();
  await input.fill("smoke-only@example.invalid");
  await expect(input).toHaveValue("smoke-only@example.invalid");
  const consent = newsletter.getByRole("checkbox");
  await expect(consent).not.toBeChecked();
  await consent.check();
  await expect(consent).toBeChecked();
  expect(errors).toEqual([]);
});


test("gallery filters wait for scripts before accepting the first search", async ({ context, page, baseURL }) => {
  const errors = trackErrors(page);
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
  let heldScripts = 0;
  await context.route(url => url.origin === new URL(baseURL!).origin &&
    url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"), async route => {
    heldScripts++;
    await scriptsReady;
    await route.continue();
  });
  const search = page.getByRole("textbox", { name: "Search albums", exact: true });
  try {
    const response = await page.goto("/gallery", { waitUntil: "commit" });
    expect(response?.status()).toBe(200);
    await expect(search).toBeVisible();
    await expect(search).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "Year", exact: true })).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "Category", exact: true })).toBeDisabled();
    expect(heldScripts).toBeGreaterThan(0);
  } finally {
    releaseScripts();
  }
  await expect(search).toBeEnabled();
  await search.fill("smoke-first-search");
  await expect(page).toHaveURL(/q=smoke-first-search/);
  await expect(search).toHaveValue("smoke-first-search");
  await expect(page.locator(".gallery-filter-panel__status")).toHaveText("Auto-filtering");
  expect(errors).toEqual([]);
});

test("gallery search updates its route and settles the archive", async ({ page }) => {
  const errors = trackErrors(page);
  await expectDocument(await page.goto("/gallery"));
  const search = page.getByRole("textbox", { name: "Search albums", exact: true });
  await search.fill("smoke-no-match");
  await expect(page).toHaveURL(/q=smoke-no-match/);
  await expect(search).toHaveValue("smoke-no-match");
  await expect(page.locator(".gallery-filter-panel__status")).toHaveText("Auto-filtering");
  expect(errors).toEqual([]);
});

test("contact fields accept input without sending a message", async ({ page }) => {
  const errors = trackErrors(page);
  await expectDocument(await page.goto("/contact"));
  await expect(page.locator('input[name="cf_turnstile_token"]'), "Public Contact must retain CAPTCHA").toHaveCount(1);
  await page.locator("#contact-name").fill("Public smoke check");
  await expect(page.locator("#contact-name")).toHaveValue("Public smoke check");
  await page.locator("#contact-category").selectOption("certificate_verification");
  await expect(page.locator("#contact-category")).toHaveValue("certificate_verification");
  await page.locator("#contact-message").fill("Local input only; never submitted.");
  await expect(page.locator("#contact-message")).toHaveValue("Local input only; never submitted.");
  expect(errors).toEqual([]);
});

for (const workspace of ["admin", "portal"]) {
  test(workspace + " login inputs render and accept edits without signing in", async ({ page }) => {
    const errors = trackErrors(page);
    await expectDocument(await page.goto("/" + workspace + "/login"));
    await expect(page.locator('input[name="captchaToken"]'), "Public login must retain CAPTCHA").toHaveCount(1);
    const email = page.getByRole("textbox", { name: /email/i });
    const password = page.getByLabel(/password/i);
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await email.fill("smoke-only@example.invalid");
    await expect(email).toHaveValue("smoke-only@example.invalid");
    await password.fill("input-check-only");
    await expect(password).toHaveValue("input-check-only");
    expect(errors).toEqual([]);
  });
}

test("footer newsletter reserves standard CAPTCHA width without horizontal overflow", async ({ page }) => {
  const errors = trackErrors(page);
  await expectDocument(await page.goto("/certificates"));
  const newsletter = page.locator("footer .site-footer-newsletter");
  for (const width of [320, 640, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await newsletter.scrollIntoViewIfNeeded();
    await expect.poll(() => newsletter.evaluate(element => element.getBoundingClientRect().width),
      { message: `The ${width}px footer must fit a 300px horizontal challenge` }
    ).toBeGreaterThanOrEqual(300);
    const bounds = await newsletter.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("CSP diagnostics distinguish reporting from blocked execution", async ({ page }, info) => {
  const fixtureOrigin = "https://csp-fixture.invalid";
  await page.route(fixtureOrigin + "/**", route => {
    const reporting = new URL(route.request().url()).pathname === "/report";
    return route.fulfill({
      body: "<!doctype html><title>CSP fixture</title><script>window.cspDiagnosticScriptRan=true;</script>",
      headers: {
        "content-type": "text/html",
        [reporting ? "content-security-policy-report-only" : "content-security-policy"]: "script-src 'none'",
      },
      status: 200,
    });
  });
  const diagnostics = () => page.evaluate(() =>
    (window as unknown as { documentCspViolations: string[] }).documentCspViolations
  );
  const scriptRan = () => page.evaluate(() =>
    (window as unknown as { cspDiagnosticScriptRan?: boolean }).cspDiagnosticScriptRan === true
  );

  await page.goto(fixtureOrigin + "/report");
  expect(await scriptRan()).toBe(true);
  await expect.poll(diagnostics).toContain("report:script-src-elem:inline");
  expectNoBlockedScripts(await diagnostics());
  await info.attach("fixture-report-only-csp", { body: JSON.stringify(await diagnostics()), contentType: "application/json" });

  await page.goto(fixtureOrigin + "/enforce");
  expect(await scriptRan()).toBe(false);
  await expect.poll(diagnostics).toContain("enforce:script-src-elem:inline");
  const blocked = await diagnostics();
  expect(() => expectNoBlockedScripts(blocked)).toThrow();
  await info.attach("fixture-enforced-csp", { body: JSON.stringify(await diagnostics()), contentType: "application/json" });
  // This controlled negative fixture intentionally blocks a script. A fresh
  // document restores the ordinary release guard after preserving its evidence.
  await page.goto("about:blank");
});
