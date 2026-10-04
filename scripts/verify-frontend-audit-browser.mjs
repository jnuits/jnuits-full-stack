import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3100";
const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "frontend-audit-evidence");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const VIEWPORTS = [
  { width: 375, height: 667, name: "mobile-375" },
  { width: 768, height: 1024, name: "tablet-768" },
  { width: 1280, height: 800, name: "desktop-1280" },
];

const THEMES = ["light", "dark"];

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/blogs", name: "blogs-archive" },
  { path: "/members", name: "members-directory" },
  { path: "/membership-form", name: "membership-form" },
  { path: "/notices", name: "notices" },
  { path: "/newsletter/confirm?token=sample_token_xyz", name: "newsletter-confirm" },
];

async function runVerification() {
  console.log("=== Starting Automated Browser Verification for AGY Audit Remediation ===");
  const browser = await chromium.launch({ headless: true });
  const results = {
    testedRoutes: [],
    landmarkChecks: [],
    redirectChecks: [],
    specificChecks: [],
    screenshots: [],
    errors: [],
  };

  try {
    // 1. Verify /members/join redirect
    console.log("\n[Test] Verifying /members/join redirect to /membership-form...");
    const redirectContext = await browser.newContext();
    const redirectPage = await redirectContext.newPage();
    const response = await redirectPage.goto(`${BASE_URL}/members/join`, { waitUntil: "networkidle" });
    const finalUrl = redirectPage.url();
    const isRedirectOk = finalUrl.endsWith("/membership-form");
    console.log(`  -> URL after navigation: ${finalUrl} (Redirect succeeded: ${isRedirectOk})`);
    results.redirectChecks.push({
      from: "/members/join",
      to: "/membership-form",
      finalUrl,
      success: isRedirectOk,
    });
    await redirectContext.close();

    // 2. Iterate through routes across viewports and themes
    for (const route of ROUTES) {
      console.log(`\n[Route] Testing ${route.path} (${route.name})...`);

      for (const vp of VIEWPORTS) {
        for (const theme of THEMES) {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            colorScheme: theme,
          });
          const page = await context.newPage();
          const consoleErrors = [];
          page.on("pageerror", (err) => consoleErrors.push(err.message));
          page.on("console", (msg) => {
            if (msg.type() === "error") consoleErrors.push(msg.text());
          });

          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });

          // Check landmark: Exactly 1 <main> element
          const mainElements = await page.locator("main").all();
          const mainCount = mainElements.length;
          const mainId = mainCount === 1 ? await mainElements[0].getAttribute("id") : null;
          const landmarkPass = mainCount === 1 && mainId === "main-content";

          // Check skip link
          const skipLink = page.locator("a.public-skip-link");
          const hasSkipLink = (await skipLink.count()) === 1;

          // Specific route checks on desktop light
          if (vp.name === "desktop-1280" && theme === "light") {
            if (route.name === "home") {
              const emailInput = page.locator("#footer-newsletter-email");
              const hasEmailInput = (await emailInput.count()) === 1;
              const honeypot = page.locator('input[name="website"]');
              const hasHoneypot = (await honeypot.count()) > 0;
              const consent = page.locator("#footer-newsletter-consent");
              const isConsentUnchecked = (await consent.count()) > 0 && !(await consent.isChecked());
              results.specificChecks.push({
                route: "/",
                check: "Newsletter form in footer",
                hasEmailInput,
                hasHoneypot,
                isConsentUnchecked,
              });
            }

            if (route.name === "notices") {
              const textContent = await page.textContent("main#main-content");
              const hasDraftsChip = textContent.includes('"Drafts"') || textContent.includes("Drafts 0");
              const hasArchivedChip = textContent.includes('"Archived"') || textContent.includes("Archived 0");
              results.specificChecks.push({
                route: "/notices",
                check: "Truthful notice chips (F10)",
                draftsZeroAbsent: !hasDraftsChip,
                archivedZeroAbsent: !hasArchivedChip,
              });
            }

            if (route.name === "membership-form") {
              const mainText = await page.textContent("main#main-content");
              const hasStatusCheck = mainText.includes("Check application status") || mainText.includes("status-check-form");
              const hasEmailInput = (await page.locator("main#main-content input[type='email']").count()) > 0;
              results.specificChecks.push({
                route: "/membership-form",
                check: "Retired email status lookup (F2)",
                statusLookupAbsent: !hasStatusCheck && !hasEmailInput,
              });
            }

            if (route.name === "newsletter-confirm") {
              const confirmBtn = page.locator("button:has-text('Confirm subscription')");
              const hasButton = (await confirmBtn.count()) === 1;
              const currentUrl = page.url();
              const tokenScrubbed = !currentUrl.includes("token=sample_token_xyz");
              results.specificChecks.push({
                route: "/newsletter/confirm",
                check: "Explicit confirmation action and token scrubbing",
                hasExplicitButton: hasButton,
                tokenScrubbedFromUrl: tokenScrubbed,
              });
            }
          }

          // Take screenshot
          const screenshotFileName = `${route.name}_${vp.name}_${theme}.png`;
          const screenshotPath = path.join(OUTPUT_DIR, screenshotFileName);
          await page.screenshot({ path: screenshotPath, fullPage: false });
          results.screenshots.push({
            route: route.path,
            viewport: vp.name,
            theme,
            path: screenshotPath,
          });

          results.landmarkChecks.push({
            route: route.path,
            viewport: vp.name,
            theme,
            mainCount,
            mainId,
            landmarkPass,
            hasSkipLink,
            consoleErrors: consoleErrors.filter(e => !e.includes("favicon") && !e.includes("cloudflare")),
          });

          await context.close();
        }
      }
    }

    console.log("\n=== Verification Summary ===");
    console.log(`Total screenshots captured: ${results.screenshots.length}`);
    const failedLandmarks = results.landmarkChecks.filter((c) => !c.landmarkPass);
    console.log(`Landmark checks: ${results.landmarkChecks.length - failedLandmarks.length}/${results.landmarkChecks.length} passed.`);
    if (failedLandmarks.length > 0) {
      console.error("Failed landmark checks:", failedLandmarks);
    }
    console.log("Specific feature checks:", results.specificChecks);
    console.log("Redirect checks:", results.redirectChecks);

    fs.writeFileSync(
      path.join(OUTPUT_DIR, "browser-verification-summary.json"),
      JSON.stringify(results, null, 2)
    );
    console.log(`\nDetailed summary saved to: ${path.join(OUTPUT_DIR, "browser-verification-summary.json")}`);
  } finally {
    await browser.close();
  }
}

runVerification().catch((err) => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
