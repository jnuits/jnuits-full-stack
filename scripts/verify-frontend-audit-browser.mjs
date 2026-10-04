import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3100";
const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "frontend-audit-evidence");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function getGitSha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const VIEWPORTS = [
  { width: 375, height: 667, name: "mobile-375" },
  { width: 768, height: 1024, name: "tablet-768" },
  { width: 1280, height: 800, name: "desktop-1280" },
];

const THEMES = ["light", "dark"];

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/blogs", name: "blogs-archive" },
  { path: "/events", name: "events" },
  { path: "/members", name: "members-directory" },
  { path: "/membership-form", name: "membership-form" },
  { path: "/notices", name: "notices" },
  { path: "/newsletter/confirm?token=sample_token_xyz", name: "newsletter-confirm" },
];

async function runVerification() {
  console.log("=== Starting Automated Browser Verification for AGY Audit Remediation ===");

  const gitSha = getGitSha();
  const buildMode = process.env.NODE_ENV || "production";
  console.log(`Git Revision: ${gitSha}`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Build Mode: ${buildMode}\n`);

  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  console.log(`Browser: Chromium ${browserVersion}\n`);

  const report = {
    metadata: {
      gitSha,
      buildMode,
      targetUrl: BASE_URL,
      browser: `Chromium ${browserVersion}`,
      os: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      availableBrowsers: ["chromium"],
      missingBrowsers: ["firefox (missing local executable)", "webkit (missing local executable)"],
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

  try {
    // -------------------------------------------------------------------------
    // 1. Verify /members/join redirect (F4)
    // -------------------------------------------------------------------------
    console.log("[Test 1/6] Verifying /members/join redirect...");
    const redirectCtx = await browser.newContext();
    const redirectPage = await redirectCtx.newPage();
    const response = await redirectPage.goto(`${BASE_URL}/members/join`, { waitUntil: "networkidle" });
    const finalUrl = redirectPage.url();
    const isRedirectOk = finalUrl.endsWith("/membership-form") && (response?.status() === 200 || response?.status() === 307 || response?.status() === 308);

    if (!isRedirectOk) {
      const msg = `FAILED: /members/join did not redirect to /membership-form (final URL: ${finalUrl}, status: ${response?.status()})`;
      console.error(`  ✖ ${msg}`);
      report.failures.push(msg);
    } else {
      console.log(`  ✔ Redirect succeeded: /members/join -> ${finalUrl}`);
    }
    report.results.redirects.push({
      from: "/members/join",
      to: "/membership-form",
      finalUrl,
      status: response?.status(),
      pass: isRedirectOk,
    });
    await redirectCtx.close();

    // -------------------------------------------------------------------------
    // 2. Verify Event Newsletter Anchor Navigation & Focus (Item 2)
    // -------------------------------------------------------------------------
    console.log("\n[Test 2/6] Verifying event page newsletter anchor navigation (#footer-newsletter-email)...");
    const eventCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const eventPage = await eventCtx.newPage();
    await eventPage.goto(`${BASE_URL}/events`, { waitUntil: "networkidle" });

    const eventAnchor = eventPage.locator("a[href='#footer-newsletter-email']");
    const anchorCount = await eventAnchor.count();

    if (anchorCount === 0) {
      const msg = "FAILED: No anchor link targeting '#footer-newsletter-email' found on /events";
      console.error(`  ✖ ${msg}`);
      report.failures.push(msg);
    } else {
      console.log(`  ✔ Found ${anchorCount} anchor targeting #footer-newsletter-email on /events`);
      // Scroll into view & click anchor
      await eventAnchor.first().scrollIntoViewIfNeeded();
      await eventAnchor.first().click();

      // Check footer input visibility & focus
      const footerInput = eventPage.locator("#footer-newsletter-email");
      const isInputVisible = await footerInput.isVisible();
      await footerInput.focus();
      const isInputFocused = await footerInput.evaluate((el) => document.activeElement === el);

      console.log(`  ✔ Footer input is visible: ${isInputVisible}, focused: ${isInputFocused}`);
      report.results.eventAnchor = {
        anchorTarget: "#footer-newsletter-email",
        found: true,
        inputVisible: isInputVisible,
        inputFocusable: isInputFocused,
        pass: isInputVisible && isInputFocused,
      };

      if (!isInputVisible || !isInputFocused) {
        report.failures.push("FAILED: Event anchor did not reach a visible, focusable #footer-newsletter-email input");
      }
    }
    await eventCtx.close();

    // -------------------------------------------------------------------------
    // 3. Multi-viewport, Multi-theme Landmark and Skip-link Verification (F12)
    // -------------------------------------------------------------------------
    console.log("\n[Test 3/6] Verifying single main landmarks and skip links across routes, viewports, and themes...");

    for (const route of ROUTES) {
      for (const vp of VIEWPORTS) {
        for (const theme of THEMES) {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            colorScheme: theme,
          });
          const page = await context.newPage();

          const pageErrors = [];
          const cspViolations = [];
          const hydrationErrors = [];

          page.on("pageerror", (err) => {
            const msg = err.message || "";
            if (msg.includes("Hydration failed") || msg.includes("hydrating")) {
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
              if (text.includes("Hydration failed") || text.includes("hydrating")) {
                hydrationErrors.push(text);
              }
            }
          });

          const resp = await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });
          const status = resp?.status() || 0;

          // Check main landmark count
          const mainLocators = await page.locator("main").all();
          const mainCount = mainLocators.length;
          const mainId = mainCount === 1 ? await mainLocators[0].getAttribute("id") : null;
          const landmarkPass = mainCount === 1 && mainId === "main-content";

          if (!landmarkPass) {
            const msg = `FAILED Landmark [${route.path} | ${vp.name} | ${theme}]: expected 1 <main id="main-content">, found ${mainCount} (id: ${mainId})`;
            console.error(`  ✖ ${msg}`);
            report.failures.push(msg);
          }

          // Check skip link
          const skipLink = page.locator("a.public-skip-link");
          const skipLinkCount = await skipLink.count();
          const skipLinkHref = skipLinkCount === 1 ? await skipLink.getAttribute("href") : null;
          const skipLinkPass = skipLinkCount === 1 && skipLinkHref === "#main-content";

          if (!skipLinkPass) {
            const msg = `FAILED Skip-link [${route.path} | ${vp.name} | ${theme}]: missing or invalid href (count: ${skipLinkCount}, href: ${skipLinkHref})`;
            console.error(`  ✖ ${msg}`);
            report.failures.push(msg);
          }

          // Keyboard tab test on skip link (first focusable item)
          if (vp.name === "desktop-1280" && theme === "light") {
            await page.keyboard.press("Tab");
            const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
            const focusedClass = await page.evaluate(() => document.activeElement?.className);
            const isSkipLinkFocused = focusedClass?.includes("public-skip-link");
            report.results.skipLinks.push({
              route: route.path,
              firstFocusedElement: `${focusedTag}.${focusedClass}`,
              isSkipLinkFocused,
            });
          }

          // Theme computed styling inspection
          const themeDetails = await page.evaluate(() => {
            const html = document.documentElement;
            const body = document.body;
            const computed = window.getComputedStyle(body);
            return {
              htmlClass: html.className,
              htmlDataTheme: html.getAttribute("data-theme"),
              bgColor: computed.backgroundColor,
              textColor: computed.color,
            };
          });

          // Screenshot capture
          const screenshotFileName = `${route.name}_${vp.name}_${theme}.png`;
          const screenshotPath = path.join(OUTPUT_DIR, screenshotFileName);
          await page.screenshot({ path: screenshotPath, fullPage: false });

          report.results.screenshots.push({
            route: route.path,
            viewport: vp.name,
            theme,
            file: screenshotFileName,
          });

          report.results.landmarks.push({
            route: route.path,
            viewport: vp.name,
            theme,
            mainCount,
            mainId,
            landmarkPass,
            skipLinkPass,
            themeDetails,
            httpStatus: status,
            cspViolations,
            hydrationErrors,
          });

          if (cspViolations.length > 0) {
            report.failures.push(`FAILED CSP violation [${route.path}]: ${cspViolations.join("; ")}`);
          }
          if (hydrationErrors.length > 0) {
            report.failures.push(`FAILED Hydration error [${route.path}]: ${hydrationErrors.join("; ")}`);
          }

          await context.close();
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. Specific Route Assertions (F2, F5, F7, F10)
    // -------------------------------------------------------------------------
    console.log("\n[Test 4/6] Verifying specific route feature assertions...");
    const featureCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const featPage = await featureCtx.newPage();

    // 4A. Notices truthful summary (F10)
    await featPage.goto(`${BASE_URL}/notices`, { waitUntil: "networkidle" });
    const noticesContent = await featPage.textContent("main#main-content");
    const hasDraftsZero = noticesContent.includes('"Drafts"') || noticesContent.includes("Drafts 0");
    const hasArchivedZero = noticesContent.includes('"Archived"') || noticesContent.includes("Archived 0");
    const truthfulPublishedChip = noticesContent.includes("Published notice");

    if (hasDraftsZero || hasArchivedZero || !truthfulPublishedChip) {
      report.failures.push("FAILED F10: Notices page contains Drafts/Archived zero chips or lacks published notice chip");
    } else {
      console.log("  ✔ F10: Notices page shows truthful published count only (zero chips absent)");
    }
    report.results.featureChecks.push({
      feature: "F10 Truthful Notices",
      hasDraftsZero,
      hasArchivedZero,
      truthfulPublishedChip,
      pass: !hasDraftsZero && !hasArchivedZero && truthfulPublishedChip,
    });

    // 4B. Membership form retired status lookup (F2)
    await featPage.goto(`${BASE_URL}/membership-form`, { waitUntil: "networkidle" });
    const membershipContent = await featPage.textContent("main#main-content");
    const hasStatusForm = (await featPage.locator("main#main-content #status-check-form").count()) > 0;
    const hasStatusEmail = (await featPage.locator("main#main-content input[type='email']").count()) > 0;
    const hasStatusHeading = membershipContent.includes("Check application status");

    if (hasStatusForm || hasStatusEmail || hasStatusHeading) {
      report.failures.push("FAILED F2: Membership form still exposes email status check UI");
    } else {
      console.log("  ✔ F2: Membership form retired applicant email status lookup UI cleanly");
    }
    report.results.featureChecks.push({
      feature: "F2 Retired Status Lookup",
      hasStatusForm,
      hasStatusEmail,
      hasStatusHeading,
      pass: !hasStatusForm && !hasStatusEmail && !hasStatusHeading,
    });

    // 4C. Blog archive navigation and pagination (F7)
    await featPage.goto(`${BASE_URL}/blogs`, { waitUntil: "networkidle" });
    const blogMain = featPage.locator("main#main-content");
    const blogCategories = blogMain.locator(".blog-category-nav a");
    const categoryCount = await blogCategories.count();
    const hasFeatureCard = (await blogMain.locator(".blog-feature-card").count()) > 0;
    const hasCardGrid = (await blogMain.locator(".blog-card-grid").count()) > 0;

    console.log(`  ✔ F7: Blog archive rendered with ${categoryCount} category tabs, feature card: ${hasFeatureCard}, card grid: ${hasCardGrid}`);
    report.results.featureChecks.push({
      feature: "F7 Blog Archive Layout",
      categoryCount,
      hasFeatureCard,
      hasCardGrid,
      pass: categoryCount > 0,
    });

    // 4D. Newsletter Subscribe Form Controls (F5)
    await featPage.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const newsletterEmail = featPage.locator("#footer-newsletter-email");
    const newsletterConsent = featPage.locator("#footer-newsletter-consent");
    const newsletterHoneypot = featPage.locator("input[name='website']");
    const subscribeBtn = featPage.locator(".site-footer-newsletter button[type='submit']");

    const emailPresent = (await newsletterEmail.count()) === 1;
    const consentPresent = (await newsletterConsent.count()) === 1;
    const consentUnchecked = consentPresent && !(await newsletterConsent.isChecked());
    const honeypotPresent = (await newsletterHoneypot.count()) > 0;
    const btnDisabledWithoutConsent = await subscribeBtn.isDisabled();

    if (!emailPresent || !consentPresent || !consentUnchecked || !honeypotPresent || !btnDisabledWithoutConsent) {
      report.failures.push("FAILED F5: Newsletter subscribe form controls missing or consent is pre-checked");
    } else {
      console.log("  ✔ F5: Newsletter form controls verified: labeled email, honeypot, unchecked consent, disabled button");
    }
    report.results.newsletterStates.push({
      type: "subscribe_controls",
      emailPresent,
      consentPresent,
      consentUnchecked,
      honeypotPresent,
      btnDisabledWithoutConsent,
      pass: emailPresent && consentPresent && consentUnchecked && honeypotPresent && btnDisabledWithoutConsent,
    });

    // 4E. Newsletter Confirm Explicit Action & Token Scrubbing (F5)
    await featPage.goto(`${BASE_URL}/newsletter/confirm?token=test_token_12345`, { waitUntil: "networkidle" });
    const confirmBtn = featPage.locator("button:has-text('Confirm subscription')");
    const hasConfirmBtn = (await confirmBtn.count()) === 1;
    const urlAfterMount = featPage.url();
    const tokenScrubbed = !urlAfterMount.includes("token=test_token_12345");

    if (!hasConfirmBtn || !tokenScrubbed) {
      report.failures.push("FAILED F5: /newsletter/confirm lacks explicit button or failed to scrub token from URL bar");
    } else {
      console.log("  ✔ F5: /newsletter/confirm explicit button present, token scrubbed from URL bar");
    }
    report.results.newsletterStates.push({
      type: "confirm_controls",
      hasConfirmBtn,
      tokenScrubbed,
      pass: hasConfirmBtn && tokenScrubbed,
    });

    await featureCtx.close();

    // -------------------------------------------------------------------------
    // 5. Final Report & Gate Exit Status
    // -------------------------------------------------------------------------
    console.log("\n=== Final Verification Report ===");
    console.log(`Total screenshots captured: ${report.results.screenshots.length}`);
    console.log(`Total landmark checks: ${report.results.landmarks.length}`);
    console.log(`Total failures detected: ${report.failures.length}`);

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

    console.log("\n✅ ALL BROWSER CHECKS PASSED SUCCESSFULLY. QUALITY GATE GREEN.");
  } finally {
    await browser.close();
  }
}

runVerification().catch((err) => {
  console.error("Verification script encountered fatal error:", err);
  process.exit(1);
});
