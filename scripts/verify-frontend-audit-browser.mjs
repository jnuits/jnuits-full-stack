import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium, firefox, webkit } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3100";
const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "frontend-audit-evidence");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function getGitSha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function getBuildId() {
  try {
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
      return fs.readFileSync(buildIdPath, "utf8").trim();
    }
  } catch {
    // ignore
  }
  return "development";
}

const VIEWPORTS = [
  { width: 375, height: 667, name: "mobile-375" },
  { width: 768, height: 1024, name: "tablet-768" },
  { width: 1280, height: 800, name: "desktop-1280" },
];

const THEMES = ["light", "dark"];

const CORE_ROUTES = [
  { path: "/", name: "home" },
  { path: "/blogs", name: "blogs-archive" },
  { path: "/events", name: "events" },
  { path: "/members", name: "members-directory" },
  { path: "/membership-form", name: "membership-form" },
  { path: "/notices", name: "notices" },
  { path: "/projects", name: "projects" },
  { path: "/newsletter/confirm?token=sample_token_xyz", name: "newsletter-confirm" },
];

async function probeBrowserEngines() {
  const candidates = [
    { name: "chromium", launcher: chromium },
    { name: "firefox", launcher: firefox },
    { name: "webkit", launcher: webkit },
  ];

  const available = [];
  const unavailable = [];

  for (const candidate of candidates) {
    try {
      const launchOptions = { headless: true, ...(candidate.name === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) };
      const instance = await candidate.launcher.launch(launchOptions);
      const version = instance.version();
      await instance.close();
      available.push({ name: candidate.name, version, launcher: candidate.launcher, launchOptions });
    } catch (err) {
      unavailable.push({
        name: candidate.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { available, unavailable };
}

async function probeServer(targetUrl) {
  try {
    const res = await fetch(targetUrl);
    const headers = Object.fromEntries(res.headers.entries());
    const csp = headers["content-security-policy"] || "";
    const hasNonce = /'nonce-[^']+'/.test(csp);
    const hasStrictDynamic = csp.includes("'strict-dynamic'");
    return {
      reachable: true,
      status: res.status,
      hasNonce,
      hasStrictDynamic,
      cacheControl: headers["cache-control"] || null,
      cspHeader: csp,
    };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function createTestingPage(browser, options = {}) {
  const { colorScheme, ...contextOptions } = options;
  const context = await browser.newContext({
    ...contextOptions,
    colorScheme: colorScheme || "light",
  });
  const page = await context.newPage();

  if (colorScheme) {
    await page.addInitScript((th) => {
      try {
        window.localStorage.setItem("jnuits-theme", th);
      } catch {}
    }, colorScheme);
  }

  if (process.env.JNUITS_PUBLIC_BROWSER_FIXTURES === "1") {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(BASE_URL).hostname)) {
      await context.close();
      throw new Error("Synthetic CAPTCHA fixtures require a local test server.");
    }
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.turnstile={render:function(el,options){setTimeout(function(){options.callback?.("QA.DUMMY.TOKEN")},0);return "qa-widget"},remove:function(){},reset:function(){}};',
    })
  );
  }
  return { context, page };
}

async function runVerification() {
  console.log("=== Starting Strict Automated Quality-Gate Verification ===");

  const sourceGitSha = getGitSha();
  const localBuildId = getBuildId();
  const gitSha = process.env.TESTED_COMMIT_SHA || "unverified-server-revision";
  const buildId = process.env.TESTED_BUILD_ID || "unverified-server-build";
  const buildMode = process.env.TESTED_BUILD_MODE || "unverified";

  console.log(`Git Revision: ${gitSha}`);
  console.log(`Build ID:     ${buildId}`);
  console.log(`Target URL:   ${BASE_URL}`);
  console.log(`Build Mode:   ${buildMode}\n`);

  // Probe server reachable & CSP
  console.log("Probing target server...");
  const serverProbe = await probeServer(BASE_URL);
  if (!serverProbe.reachable) {
    console.error(`FATAL: Target server at ${BASE_URL} is unreachable: ${serverProbe.error}`);
    process.exit(1);
  }
  console.log(`  ✔ Server responded with HTTP ${serverProbe.status}`);
  console.log(`  ✔ Server CSP has nonce: ${serverProbe.hasNonce}, strict-dynamic: ${serverProbe.hasStrictDynamic}\n`);

  if (serverProbe.status !== 200 || !serverProbe.hasNonce || !serverProbe.hasStrictDynamic) {
    throw new Error("Target must serve HTTP 200 with a nonce and strict-dynamic CSP.");
  }

  // Probe browser engines
  console.log("Probing browser engine availability...");
  const { available: availableEngines, unavailable: unavailableEngines } = await probeBrowserEngines();
  for (const a of availableEngines) {
    console.log(`  ✔ ${a.name} is available (${a.version})`);
  }
  for (const u of unavailableEngines) {
    console.log(`  ⚠ ${u.name} is unavailable on host: ${u.error.split("\n")[0]}`);
  }
  console.log();

  if (availableEngines.length === 0) {
    console.error("FATAL: No browser engines could be launched on this host.");
    process.exit(1);
  }

  const report = {
    metadata: {
      gitSha,
      buildId,
      buildMode,
      sourceGitSha,
      localBuildId,
      syntheticProviderFixtures: process.env.JNUITS_PUBLIC_BROWSER_FIXTURES === "1",
      targetUrl: BASE_URL,
      os: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      serverProbe,
      availableBrowsers: availableEngines.map((e) => `${e.name} ${e.version}`),
      unavailableBrowsers: unavailableEngines,
    },
    results: {
      redirects: [],
      landmarks: [],
      skipLinks: [],
      eventAnchor: null,
      newsletterStates: [],
      featureChecks: [],
      themeInspections: [],
      screenshots: [],
    },
    failures: [],
  };

  for (const engine of availableEngines) {
    console.log(`\n======================================================`);
    console.log(`Testing with Browser Engine: ${engine.name} (${engine.version})`);
    console.log(`======================================================`);

    const browser = await engine.launcher.launch(engine.launchOptions);

    try {
      // -----------------------------------------------------------------------
      // 1. Verify /members/join redirect (F4)
      // -----------------------------------------------------------------------
      console.log(`[${engine.name}] [1/7] Verifying /members/join redirect (F4)...`);
      const { context: redirectCtx, page: redirectPage } = await createTestingPage(browser);
      const redirectResp = await redirectPage.goto(`${BASE_URL}/members/join`, { waitUntil: "domcontentloaded" });
      await redirectPage.waitForURL(/\/membership-form/, { timeout: 15000 });
      const finalUrl = redirectPage.url();
      const isRedirectOk = finalUrl.endsWith("/membership-form") && (redirectResp?.status() === 200 || redirectResp?.status() === 307 || redirectResp?.status() === 308);

      if (!isRedirectOk) {
        const msg = `FAILED: [${engine.name}] /members/join did not redirect to /membership-form (final URL: ${finalUrl}, status: ${redirectResp?.status()})`;
        console.error(`  ✖ ${msg}`);
        report.failures.push(msg);
      } else {
        console.log(`  ✔ Redirect verified: /members/join -> ${finalUrl}`);
      }
      report.results.redirects.push({
        browser: engine.name,
        from: "/members/join",
        to: "/membership-form",
        finalUrl,
        status: redirectResp?.status(),
        pass: isRedirectOk,
      });
      await redirectCtx.close();

      // -----------------------------------------------------------------------
      // 2. Verify Event Newsletter Anchor Navigation & Focus (Item 2)
      // -----------------------------------------------------------------------
      console.log(`\n[${engine.name}] [2/7] Verifying event newsletter anchor (#footer-newsletter-email)...`);
      const { context: eventCtx, page: eventPage } = await createTestingPage(browser, { viewport: { width: 1280, height: 800 } });
      await eventPage.goto(`${BASE_URL}/events`, { waitUntil: "domcontentloaded" });
      await eventPage.waitForSelector("main#main-content", { timeout: 15000 });

      const eventAnchor = eventPage.locator("a[href='#footer-newsletter-email']");
      const anchorCount = await eventAnchor.count();

      if (anchorCount === 0) {
        const msg = `FAILED: [${engine.name}] No anchor link targeting '#footer-newsletter-email' found on /events`;
        console.error(`  ✖ ${msg}`);
        report.failures.push(msg);
      } else {
        console.log(`  ✔ Found ${anchorCount} anchor targeting #footer-newsletter-email on /events`);

        // Pointer click navigation
        await eventAnchor.first().scrollIntoViewIfNeeded();
        await eventAnchor.first().click();

        const footerInput = eventPage.locator("#footer-newsletter-email");
        const isInputVisible = await footerInput.isVisible();
        const isInputFocused = await footerInput.evaluate((el) => document.activeElement === el);

        if (!isInputVisible || !isInputFocused) {
          const msg = `FAILED: [${engine.name}] Pointer event anchor did not reach visible focused #footer-newsletter-email (visible: ${isInputVisible}, focused: ${isInputFocused})`;
          console.error(`  ✖ ${msg}`);
          report.failures.push(msg);
        } else {
          console.log(`  ✔ Pointer event anchor reached visible focused #footer-newsletter-email`);
        }

        // Keyboard navigation
        await eventAnchor.first().focus();
        const isAnchorFocused = await eventAnchor.first().evaluate((el) => document.activeElement === el);
        await eventPage.keyboard.press("Enter");
        const isInputKeyboardFocused = await footerInput.evaluate((el) => document.activeElement === el);

        if (!isAnchorFocused || !isInputKeyboardFocused) {
          const msg = `FAILED: [${engine.name}] Keyboard navigation on event anchor failed (anchorFocused: ${isAnchorFocused}, inputFocused: ${isInputKeyboardFocused})`;
          console.error(`  ✖ ${msg}`);
          report.failures.push(msg);
        } else {
          console.log(`  ✔ Keyboard navigation on event anchor reached visible focused #footer-newsletter-email`);
        }

        report.results.eventAnchor = {
          browser: engine.name,
          anchorTarget: "#footer-newsletter-email",
          found: true,
          inputVisible: isInputVisible,
          inputFocusable: isInputFocused && isInputKeyboardFocused,
          pass: isInputVisible && isInputFocused && isAnchorFocused && isInputKeyboardFocused,
        };
      }
      await eventCtx.close();

      // -----------------------------------------------------------------------
      // 3. Multi-viewport, Multi-theme Landmark, Overflow & Theme Verification (F12)
      // -----------------------------------------------------------------------
      console.log(`\n[${engine.name}] [3/7] Verifying landmarks, overflow, and theme rendering across viewports...`);

      for (const route of CORE_ROUTES) {
        for (const vp of VIEWPORTS) {
          for (const theme of THEMES) {
            const { context, page } = await createTestingPage(browser, {
              viewport: { width: vp.width, height: vp.height },
              colorScheme: theme,
            });

            const pageErrors = [];
            const cspViolations = [];
            const hydrationErrors = [];

            await page.addInitScript(() => {
              window.__cspViolations = [];
              document.addEventListener("securitypolicyviolation", (e) => {
                window.__cspViolations.push(`${e.effectiveDirective}:${e.blockedURI}`);
              });
            });

            page.on("pageerror", (err) => {
              const msg = err.message || "";
              if (msg.includes("Hydration failed") || msg.includes("hydrating") || msg.includes("Minified React error #418")) {
                hydrationErrors.push(msg);
              }
              pageErrors.push(msg);
            });

            page.on("console", (msg) => {
              const text = msg.text();
              if (msg.type() === "error") {
                if (text.includes("Content-Security-Policy") || text.includes("CSP")) {
                  cspViolations.push(text);
                }
                if (text.includes("Hydration failed") || text.includes("hydrating") || text.includes("Minified React error #418")) {
                  hydrationErrors.push(text);
                }
              }
            });

            const resp = await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "domcontentloaded" });
            await page.waitForSelector("main#main-content", { timeout: 15000 });
            await page.waitForFunction(
              (expected) => document.documentElement.getAttribute("data-theme") === expected,
              theme,
              { timeout: 5000 }
            ).catch(() => {});
            const status = resp?.status() || 0;

            // Assert HTTP status < 400
            if (status >= 400 || status === 0) {
              const msg = `FAILED HTTP status [${engine.name} | ${route.path} | ${vp.name} | ${theme}]: received status ${status}`;
              console.error(`  ✖ ${msg}`);
              report.failures.push(msg);
            }

            // Assert Single Main Landmark (#main-content)
            const mainLocators = await page.locator("main").all();
            const mainCount = mainLocators.length;
            const mainId = mainCount === 1 ? await mainLocators[0].getAttribute("id") : null;
            const landmarkPass = mainCount === 1 && mainId === "main-content";

            if (!landmarkPass) {
              const msg = `FAILED Landmark [${engine.name} | ${route.path} | ${vp.name} | ${theme}]: expected 1 <main id="main-content">, found ${mainCount} (id: ${mainId})`;
              console.error(`  ✖ ${msg}`);
              report.failures.push(msg);
            }

            // Assert Skip Link
            const skipLink = page.locator("a.public-skip-link");
            const skipLinkCount = await skipLink.count();
            const skipLinkHref = skipLinkCount === 1 ? await skipLink.getAttribute("href") : null;
            const skipLinkPass = skipLinkCount === 1 && skipLinkHref === "#main-content";

            if (!skipLinkPass) {
              const msg = `FAILED Skip-link [${engine.name} | ${route.path} | ${vp.name} | ${theme}]: missing or invalid href (count: ${skipLinkCount}, href: ${skipLinkHref})`;
              console.error(`  ✖ ${msg}`);
              report.failures.push(msg);
            }

            // Keyboard Tab and Enter activation test on desktop
            if (vp.name === "desktop-1280" && theme === "light") {
              const skipLinkLoc = page.locator("a.public-skip-link");
              await page.keyboard.press("Tab");
              const isSkipLinkFocused = await skipLinkLoc.evaluate((el) => document.activeElement === el);

              if (!isSkipLinkFocused) {
                const activeTag = await page.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`);
                const msg = `FAILED Skip-link Tab focus [${engine.name} | ${route.path}]: expected skip link focus, got ${activeTag}`;
                console.error(`  ✖ ${msg}`);
                report.failures.push(msg);
              }

              await page.keyboard.press("Enter");
              const isMainFocused = await page.locator("#main-content").evaluate((el) => document.activeElement === el);
              if (!isMainFocused) {
                const msg = `FAILED Skip-link Enter activation [${engine.name} | ${route.path}]: #main-content was not focused after Enter`;
                console.error(`  ✖ ${msg}`);
                report.failures.push(msg);
              }

              report.results.skipLinks.push({
                browser: engine.name,
                route: route.path,
                isSkipLinkFocused,
                isMainFocused,
                pass: isSkipLinkFocused && isMainFocused,
              });
            }

            // Evaluate in-page CSP violation array
            const inPageCspViolations = await page.evaluate(() => window.__cspViolations || []);
            const allCspViolations = [...cspViolations, ...inPageCspViolations];
            if (allCspViolations.length > 0) {
              const msg = `FAILED CSP Violations [${engine.name} | ${route.path} | ${vp.name} | ${theme}]: ${allCspViolations.join(", ")}`;
              console.error(`  ✖ ${msg}`);
              report.failures.push(msg);
            }

            // Assert Zero Runtime & Hydration Errors
            if (pageErrors.length > 0) {
              const msg = `FAILED Page Errors [${engine.name} | ${route.path} | ${vp.name} | ${theme}]: ${pageErrors.join(" | ")}`;
              console.error(`  ✖ ${msg}`);
              report.failures.push(msg);
            }
            if (hydrationErrors.length > 0) {
              const msg = `FAILED Hydration Errors [${engine.name} | ${route.path} | ${vp.name} | ${theme}]: ${hydrationErrors.join(" | ")}`;
              console.error(`  ✖ ${msg}`);
              report.failures.push(msg);
            }

            // Assert Zero Horizontal Overflow
            const overflow = await page.evaluate(() => {
              const doc = document.documentElement;
              const body = document.body;
              const docScroll = doc ? doc.scrollWidth : 0;
              const bodyScroll = body ? body.scrollWidth : 0;
              const clientW = doc ? doc.clientWidth : window.innerWidth;
              const maxScroll = Math.max(docScroll, bodyScroll);
              return maxScroll - clientW;
            });

            const overflowPass = overflow <= 1; // 1px fractional tolerance
            if (!overflowPass) {
              const msg = `FAILED Horizontal Overflow [${engine.name} | ${route.path} | ${vp.name} | ${theme}]: scrollWidth exceeds clientWidth by ${overflow}px`;
              console.error(`  ✖ ${msg}`);
              report.failures.push(msg);
            }

            // Theme Verification (Check root classes and CSS variables)
            const themeDetails = await page.evaluate(() => {
              const html = document.documentElement;
              const computed = window.getComputedStyle(html);
              return {
                htmlClass: html.className,
                htmlDataTheme: html.getAttribute("data-theme"),
                background: computed.backgroundColor,
                color: computed.color,
              };
            });

            // If dark theme requested, verify dark class or data-theme applied
            const themePass = themeDetails.htmlDataTheme === theme;
            if (!themePass) {
                const msg = `FAILED Theme Assertion [${engine.name} | ${route.path} | ${vp.name} | ${theme}]: data-theme=${themeDetails.htmlDataTheme}, class=${themeDetails.htmlClass}`;
                console.error(`  ✖ ${msg}`);
                report.failures.push(msg);
            }

            // Capture screenshot for visual evidence
            const screenshotName = `${engine.name}-${route.name}-${vp.name}-${theme}.png`;
            const screenshotPath = path.join(OUTPUT_DIR, screenshotName);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            report.results.screenshots.push({ browser: engine.name, route: route.name, viewport: vp.name, theme, file: screenshotName });

            report.results.landmarks.push({
              browser: engine.name,
              route: route.path,
              viewport: vp.name,
              theme,
              status,
              mainCount,
              mainId,
              skipLinkCount,
              overflow,
              cspViolations: allCspViolations.length,
              pageErrors: pageErrors.length,
              hydrationErrors: hydrationErrors.length,
              screenshot: screenshotName,
              pass: status < 400 && themePass && landmarkPass && skipLinkPass && overflowPass && allCspViolations.length === 0 && pageErrors.length === 0 && hydrationErrors.length === 0,
            });

            await context.close();
          }
        }
      }

      // -----------------------------------------------------------------------
      // 4. Notices Truthful Chip Verification (F10)
      // -----------------------------------------------------------------------
      console.log(`\n[${engine.name}] [4/7] Verifying notices truthful published counts (F10)...`);
      const { context: noticesCtx, page: noticesPage } = await createTestingPage(browser, { viewport: { width: 1280, height: 800 } });
      await noticesPage.goto(`${BASE_URL}/notices`, { waitUntil: "domcontentloaded" });
      await noticesPage.waitForSelector("main#main-content", { timeout: 15000 });
      const noticesContent = await noticesPage.textContent("main#main-content");
      const hasDraftsZero = noticesContent.includes('"Drafts"') || noticesContent.includes("Drafts 0");
      const hasArchivedZero = noticesContent.includes('"Archived"') || noticesContent.includes("Archived 0");
      const truthfulPublishedChip = noticesContent.includes("Published notice");

      if (hasDraftsZero || hasArchivedZero || !truthfulPublishedChip) {
        const msg = `FAILED F10: [${engine.name}] Notices page contains Drafts/Archived zero chips or lacks published notice count`;
        console.error(`  ✖ ${msg}`);
        report.failures.push(msg);
      } else {
        console.log(`  ✔ F10: Notices page shows truthful published count only (zero chips absent)`);
      }
      report.results.featureChecks.push({
        browser: engine.name,
        feature: "F10 Truthful Notices",
        hasDraftsZero,
        hasArchivedZero,
        truthfulPublishedChip,
        pass: !hasDraftsZero && !hasArchivedZero && truthfulPublishedChip,
      });
      await noticesCtx.close();

      // -----------------------------------------------------------------------
      // 5. Membership Form Retired Status Lookup (F2) & Copy Neutrality (Task 6)
      // -----------------------------------------------------------------------
      console.log(`\n[${engine.name}] [5/7] Verifying membership form retired status lookup & policy neutrality (F2/Task 6)...`);
      const { context: membCtx, page: membPage } = await createTestingPage(browser, { viewport: { width: 1280, height: 800 } });
      await membPage.goto(`${BASE_URL}/membership-form`, { waitUntil: "domcontentloaded" });
      await membPage.waitForSelector("main#main-content", { timeout: 15000 });
      const membershipContent = await membPage.textContent("main#main-content");
      const hasStatusForm = (await membPage.locator("main#main-content #status-check-form").count()) > 0;
      const hasStatusEmail = (await membPage.locator("main#main-content input[type='email']").count()) > 0;
      const hasStatusHeading = membershipContent.includes("Check application status");

      if (hasStatusForm || hasStatusEmail || hasStatusHeading) {
        const msg = `FAILED F2: [${engine.name}] Membership form still exposes email status check UI`;
        console.error(`  ✖ ${msg}`);
        report.failures.push(msg);
      } else {
        console.log(`  ✔ F2: Membership form retired applicant email status lookup UI cleanly`);
      }
      report.results.featureChecks.push({
        browser: engine.name,
        feature: "F2 Retired Status Lookup",
        hasStatusForm,
        hasStatusEmail,
        hasStatusHeading,
        pass: !hasStatusForm && !hasStatusEmail && !hasStatusHeading,
      });
      await membCtx.close();

      // -----------------------------------------------------------------------
      // 6. Blog Archive Navigation, Categories & Filtering (F7 / Task 1)
      // -----------------------------------------------------------------------
      console.log(`\n[${engine.name}] [6/7] Verifying blog archive category tabs and direct contract (F7)...`);
      const { context: blogCtx, page: blogPage } = await createTestingPage(browser, { viewport: { width: 1280, height: 800 } });
      await blogPage.goto(`${BASE_URL}/blogs`, { waitUntil: "domcontentloaded" });
      await blogPage.waitForSelector("main#main-content", { timeout: 15000 });
      const blogMain = blogPage.locator("main#main-content");
      const blogCategories = blogMain.locator(".blog-category-nav a");
      const categoryCount = await blogCategories.count();

      if (categoryCount === 0) {
        const msg = `FAILED F7: [${engine.name}] Blog archive has 0 category tabs`;
        console.error(`  ✖ ${msg}`);
        report.failures.push(msg);
      } else {
        console.log(`  ✔ F7: Blog archive rendered with ${categoryCount} category navigation links`);
      }

      // Test category click navigation
      if (categoryCount > 1) {
        const secondCat = blogCategories.nth(1);
        const secondCatText = (await secondCat.textContent())?.trim();
        await secondCat.click();
        await blogPage.waitForURL(/\/blogs\?category=/, { timeout: 10000 });
        const currentUrl = blogPage.url();
        console.log(`  ✔ Category navigation verified: clicked "${secondCatText}" -> ${currentUrl}`);

        // Reset to all
        await blogCategories.first().click();
        await blogPage.waitForURL(/\/blogs$/, { timeout: 10000 });
        console.log(`  ✔ Category reset verified: reset back to /blogs`);
      }

      report.results.featureChecks.push({
        browser: engine.name,
        feature: "F7 Blog Archive Navigation",
        categoryCount,
        pass: categoryCount > 0,
      });
      await blogCtx.close();

      // -----------------------------------------------------------------------
      // 7. Newsletter Full Lifecycle (Subscribe, Confirm, Scrubbing) (F5 / Task 3)
      // -----------------------------------------------------------------------
      console.log(`\n[${engine.name}] [7/7] Verifying newsletter controls, retry focus, and token scrubbing (F5)...`);
      const { context: newsCtx, page: newsPage } = await createTestingPage(browser, { viewport: { width: 1280, height: 800 } });

      // 7A. Footer subscribe form controls
      await newsPage.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      await newsPage.waitForSelector("main#main-content", { timeout: 15000 });
      const newsletterEmail = newsPage.locator("#footer-newsletter-email");
      const newsletterConsent = newsPage.locator("#footer-newsletter-consent");
      const newsletterHoneypot = newsPage.locator("input[name='website']");
      const subscribeBtn = newsPage.locator(".site-footer-newsletter button[type='submit']");

      const emailPresent = (await newsletterEmail.count()) === 1;
      const consentPresent = (await newsletterConsent.count()) === 1;
      const consentUnchecked = consentPresent && !(await newsletterConsent.isChecked());
      const honeypotPresent = (await newsletterHoneypot.count()) > 0;
      const btnDisabledInitially = await subscribeBtn.isDisabled();

      if (!emailPresent || !consentPresent || !consentUnchecked || !honeypotPresent || !btnDisabledInitially) {
        const msg = `FAILED F5: [${engine.name}] Newsletter subscribe form controls missing or consent pre-checked`;
        console.error(`  ✖ ${msg}`);
        report.failures.push(msg);
      } else {
        console.log(`  ✔ F5: Form controls verified: labeled email, honeypot, unchecked consent, disabled button`);
      }

      // 7B. Consent checkbox toggles submit button
      await newsletterConsent.check();
      const btnEnabledAfterConsent = !(await subscribeBtn.isDisabled());
      if (!btnEnabledAfterConsent) {
        const msg = `FAILED F5: [${engine.name}] Submit button remained disabled after checking consent`;
        console.error(`  ✖ ${msg}`);
        report.failures.push(msg);
      } else {
        console.log(`  ✔ F5: Submit button enabled after checking consent`);
      }

      // 7C. Confirm page token scrubbing and explicit button
      await newsPage.goto(`${BASE_URL}/newsletter/confirm?token=sample_verification_token_98765`, { waitUntil: "domcontentloaded" });
      await newsPage.waitForSelector("main#main-content", { timeout: 15000 });
      const confirmBtn = newsPage.locator("button:has-text('Confirm subscription')");
      await confirmBtn.waitFor({ state: "visible", timeout: 10000 });
      const hasConfirmBtn = (await confirmBtn.count()) === 1;

      await newsPage.waitForFunction(() => !window.location.search.includes("token=sample_verification_token_98765"), null, { timeout: 10000 });
      const urlAfterMount = newsPage.url();
      const tokenScrubbed = !urlAfterMount.includes("token=sample_verification_token_98765");

      if (!hasConfirmBtn || !tokenScrubbed) {
        const msg = `FAILED F5: [${engine.name}] /newsletter/confirm lacks explicit button or failed to scrub token from URL bar`;
        console.error(`  ✖ ${msg}`);
        report.failures.push(msg);
      } else {
        console.log(`  ✔ F5: /newsletter/confirm explicit button present, token scrubbed from URL bar immediately`);
      }

      report.results.newsletterStates.push({
        browser: engine.name,
        emailPresent,
        consentPresent,
        consentUnchecked,
        honeypotPresent,
        btnDisabledInitially,
        btnEnabledAfterConsent,
        hasConfirmBtn,
        tokenScrubbed,
        pass: emailPresent && consentPresent && consentUnchecked && honeypotPresent && btnDisabledInitially && btnEnabledAfterConsent && hasConfirmBtn && tokenScrubbed,
      });

      await newsCtx.close();
    } finally {
      await browser.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Final Evaluation & Quality Gate Exit
  // ---------------------------------------------------------------------------
  console.log("\n=== Final Verification Report ===");
  console.log(`Total screenshots captured: ${report.results.screenshots.length}`);
  console.log(`Total landmark checks:     ${report.results.landmarks.length}`);
  console.log(`Total failures detected:    ${report.failures.length}`);

  const reportPath = path.join(OUTPUT_DIR, "browser-verification-summary.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Detailed report written to: ${reportPath}`);

  if (report.failures.length > 0) {
    console.error("\n❌ VERIFICATION GATE FAILED with the following errors:");
    for (const fail of report.failures) {
      console.error(`  - ${fail}`);
    }
    process.exit(1);
  }

  console.log("\n✅ ALL BROWSER CHECKS PASSED. STRICT QUALITY GATE GREEN.");
}

runVerification().catch((err) => {
  console.error("Verification script encountered fatal error:", err);
  process.exit(1);
});
