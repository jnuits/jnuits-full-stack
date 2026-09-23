#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import {
  expectedPortalLanding,
  hasPortalAuditFailures,
  isIgnorablePortalConsoleError,
  isExpectedPortalLanding,
  normalizePortalRoute,
} from "./lib/portal-audit-contracts.mjs";

const ROOT = process.cwd();
const OUTPUT_BASE = path.join(ROOT, "portal-snapshots");

const VIEWPORTS = [
  { width: 320, height: 640, label: "320px" },
  { width: 360, height: 740, label: "360px" },
  { width: 375, height: 667, label: "375px" },
  { width: 390, height: 844, label: "390px" },
  { width: 412, height: 915, label: "412px" },
  { width: 768, height: 1024, label: "768px" },
  { width: 1024, height: 768, label: "1024px" },
  { width: 1280, height: 800, label: "1280px" },
  { width: 1440, height: 900, label: "1440px" },
];

const THEMES = ["light", "dark"];

const email = process.env.PORTAL_EMAIL || process.env.E2E_CURRENT_MEMBER_EMAIL || process.env.E2E_ALUMNI_MEMBER_EMAIL;
const password = process.env.PORTAL_PASSWORD || process.env.E2E_CURRENT_MEMBER_PASSWORD || process.env.E2E_ALUMNI_MEMBER_PASSWORD;
const baseUrl = (process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const role = process.env.PORTAL_ROLE || (process.env.E2E_ALUMNI_MEMBER_EMAIL ? "alumni" : "member");
const specificRoutesArg = process.env.PORTAL_ROUTES;

const storageStatePath = path.join(OUTPUT_BASE, `storage-state-${role}.json`);
const hasStorageState = fs.existsSync(storageStatePath);
const hasCredentials = Boolean(email && password);

fs.mkdirSync(OUTPUT_BASE, { recursive: true });

async function safeEvaluate(page, fn, ...args) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await page.evaluate(fn, ...args);
    } catch (err) {
      if (
        (err.message.includes("Execution context was destroyed") ||
         err.message.includes("navigated") ||
         err.message.includes("detached")) &&
        attempt < 2
      ) {
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => undefined);
        await page.waitForTimeout(300);
        continue;
      }
      throw err;
    }
  }
}

function authenticatedRoutesForRole(portalRole) {
  if (portalRole === "advisor") {
    return [
      "/portal",
      "/portal/dashboard",
      "/portal/advisor/profile",
      "/portal/blogs",
      "/portal/profile/change-password",
      "/portal/login",
      "/portal/access-pending",
      "/profile/change-password",
    ];
  }

  return [
    "/portal",
    "/portal/dashboard",
    "/portal/profile",
    "/portal/profile/edit",
    "/portal/profile/change-password",
    "/portal/blogs",
    "/portal/tickets",
    "/portal/mentorship",
    "/portal/projects",
    "/portal/activity",
    "/portal/login",
    "/portal/access-pending",
    "/profile",
    "/profile/edit",
    "/profile/change-password",
  ];
}

async function verifyMobileDrawer(page) {
  await page.setViewportSize({ width: 360, height: 740 });

  const toggle = page.getByRole("button", { name: /open sidebar/i });
  if ((await toggle.count()) === 0 || !(await toggle.isVisible())) {
    throw new Error("Mobile portal navigation toggle is missing at 360px");
  }

  await toggle.click();
  const sidebar = page.getByRole("complementary", {
    name: /(?:member|advisor) portal navigation/i,
  });
  await sidebar.waitFor({ state: "visible" });

  const focusIsInside = await sidebar.evaluate((element) =>
    element.contains(document.activeElement)
  );
  if (!focusIsInside) {
    throw new Error("Mobile portal navigation did not receive focus after opening");
  }

  await page.keyboard.press("Escape");
  await page.waitForFunction(
    (element) => element?.getAttribute("data-open") === "false",
    await sidebar.elementHandle()
  );

  if (!(await toggle.evaluate((element) => element === document.activeElement))) {
    throw new Error("Mobile portal navigation did not restore focus after closing");
  }
}

async function main() {
  console.log(`Starting Portal UI Snapshot Audit`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Role: ${role}`);
  console.log(`Has session / credentials: ${hasStorageState || hasCredentials ? "YES" : "NO (Testing public & guard redirects)"}`);
  console.log(`Output Directory: ${OUTPUT_BASE}`);

  const browser = await chromium.launch({
    headless: true,
  });

  let context;
  let isAuthenticated = false;

  if (fs.existsSync(storageStatePath)) {
    try {
      context = await browser.newContext({
        storageState: storageStatePath,
        viewport: { width: 1440, height: 900 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JnUITS-Portal-Audit",
      });
      const probePage = await context.newPage();
      await probePage.goto(`${baseUrl}/portal`, { waitUntil: "domcontentloaded", timeout: 15000 });
      const currentUrl = probePage.url();
      if (currentUrl.includes("/portal/login")) {
        await context.close();
        context = null;
      } else {
        console.log(`Reusing authenticated session for ${role} (${currentUrl})`);
        isAuthenticated = true;
        await probePage.close();
      }
    } catch {
      context = null;
    }
  }

  if (!context && hasCredentials) {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JnUITS-Portal-Audit",
    });

    const loginPage = await context.newPage();
    console.log(`\n1. Authenticating as ${role}...`);
    await loginPage.goto(`${baseUrl}/portal/login`, { waitUntil: "domcontentloaded" });

    await loginPage.locator("#portal-login-email").fill(email);
    await loginPage.locator("#portal-login-password").fill(password);
    await loginPage.getByRole("button", { name: /sign in to portal/i }).click();

    try {
      await loginPage.waitForURL(
        (url) => url.pathname.startsWith("/portal") && url.pathname !== "/portal/login",
        { timeout: 35000 }
      );
      console.log(`Current URL after login: ${loginPage.url()}`);
      await context.storageState({ path: storageStatePath });
      isAuthenticated = true;
    } catch (err) {
      console.warn(`Login attempt did not complete to /portal (${err.message}). Continuing with guard mode.`);
    }
    await loginPage.close();
  }

  if (!context) {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JnUITS-Portal-Audit",
    });
  }

  const page = await context.newPage();
  let activeRoute = null;

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      const loc = msg.location();
      const url = loc ? loc.url || "" : "";
      // Ignore only known non-application diagnostics. Other framework,
      // application, and CAPTCHA errors remain release-blocking signals.
      if (isIgnorablePortalConsoleError({ text, url })) {
        return;
      }
      consoleErrors.push({
        route: activeRoute,
        text,
        location: loc,
      });
    }
  });

  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push({ route: activeRoute, message: err.message, stack: err.stack });
  });

  // Determine target routes to audit
  let targetRoutes = [];
  if (specificRoutesArg) {
    targetRoutes = specificRoutesArg.split(",").map((r) => r.trim()).filter(Boolean);
  } else if (isAuthenticated) {
    targetRoutes = authenticatedRoutesForRole(role);
  } else {
    // Unauthenticated mode: test entry & guard routes + redirect safety
    targetRoutes = [
      "/portal/login",
      "/portal/access-pending",
      "/portal",
      "/portal/dashboard",
      "/portal/profile",
      "/portal/profile/edit",
      "/profile",
    ];
  }

  const runMode = isAuthenticated ? "authenticated" : "guest";

  console.log(`\nTesting ${targetRoutes.length} portal routes:`);
  for (const r of targetRoutes) {
    console.log(` - ${r}`);
  }

  const auditResults = {
    role,
    baseUrl,
    isAuthenticated,
    runMode,
    timestamp: new Date().toISOString(),
    routesRequested: targetRoutes.length,
    routesChecked: 0,
    routesVerified: 0,
    redirectsVerified: 0,
    findings: [],
    routeResults: {},
  };

  let drawerInteractionVerified = false;

  for (const route of targetRoutes) {
    activeRoute = route;
    const routeSlug = route.replace(/^\//, "").replace(/\//g, "-").replace(/\?/g, "_").replace(/=/g, "-");
    const routeOutputDir = path.join(OUTPUT_BASE, role, runMode, routeSlug);
    fs.mkdirSync(routeOutputDir, { recursive: true });

    const findingStart = auditResults.findings.length;
    const consoleErrorStart = consoleErrors.length;
    const pageErrorStart = pageErrors.length;

    console.log(`\nTesting route: ${route} (${routeSlug})`);
    auditResults.routeResults[route] = {
      route,
      slug: routeSlug,
      status: "pending",
      viewports: {},
      errors: [],
    };

    try {
      let responseStatus = 0;
      try {
        const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
        responseStatus = response ? response.status() : 0;
        if (responseStatus >= 400) {
          throw new Error(`HTTP status ${responseStatus} for ${route}`);
        }
      } catch (navErr) {
        if (navErr.message.includes("ERR_ABORTED")) {
          await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => undefined);
        } else {
          throw navErr;
        }
      }

      await page.waitForLoadState("domcontentloaded").catch(() => undefined);

      const requestedRoute = normalizePortalRoute(route, baseUrl);
      const expectedRoute = expectedPortalLanding(
        requestedRoute,
        isAuthenticated,
        baseUrl
      );
      await page
        .waitForURL(
          (url) => normalizePortalRoute(url.href, baseUrl) === expectedRoute,
          { timeout: 5000 }
        )
        .catch(() => undefined);

      const landedRoute = normalizePortalRoute(page.url(), baseUrl);
      const redirected = landedRoute !== requestedRoute;

      Object.assign(auditResults.routeResults[route], {
        requestedRoute,
        expectedRoute,
        landedRoute,
        redirected,
        responseStatus,
      });

      if (
        !isExpectedPortalLanding({
          baseUrl,
          isAuthenticated,
          landedRoute,
          requestedRoute,
        })
      ) {
        throw new Error(
          `Unexpected landing for ${route}: expected ${expectedRoute}, received ${landedRoute}`
        );
      }

      if (redirected) {
        console.log(` Verified redirect: ${route} -> ${landedRoute}`);
        auditResults.redirectsVerified++;
      }

      if (
        isAuthenticated &&
        !drawerInteractionVerified &&
        (requestedRoute === "/portal" || requestedRoute === "/portal/dashboard")
      ) {
        await verifyMobileDrawer(page);
        drawerInteractionVerified = true;
        auditResults.routeResults[route].drawerInteractionVerified = true;
      }

      for (const theme of THEMES) {
        await safeEvaluate(page, (th) => {
          window.localStorage.setItem("jnuits-theme", th);
          document.documentElement.classList.toggle("dark", th === "dark");
          document.documentElement.dataset.theme = th;
          window.dispatchEvent(new Event("jnuits-theme-change"));
        }, theme);

        await page.waitForTimeout(100);

        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.waitForTimeout(200);

          // Measure horizontal overflow
          const metrics = await safeEvaluate(page, () => {
            const root = document.documentElement;
            const body = document.body;
            const scrollWidth = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
            const clientWidth = root.clientWidth;
            const overflow = scrollWidth - clientWidth;

            const overflowingElements = [];
            const allElements = document.querySelectorAll("*");
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > clientWidth + 2) {
                const idOrClass = el.id ? `#${el.id}` : el.className ? `.${String(el.className).trim().split(/\s+/)[0]}` : el.tagName.toLowerCase();
                overflowingElements.push({
                  tag: el.tagName.toLowerCase(),
                  selector: idOrClass,
                  rectRight: Math.round(rect.right),
                  clientWidth,
                });
                if (overflowingElements.length >= 3) break;
              }
            }

            const brokenImages = [];
            const images = document.querySelectorAll("img");
            for (const img of images) {
              if (img.complete && img.naturalWidth === 0) {
                brokenImages.push(img.src || img.getAttribute("src"));
              }
            }

            const frameworkErrors = [];
            const frameworkErrorSelectors = [
              "nextjs-portal [data-nextjs-dialog]",
              "nextjs-portal [role='dialog']",
              "nextjs-portal [data-nextjs-toast]",
            ];
            for (const selector of frameworkErrorSelectors) {
              for (const element of document.querySelectorAll(selector)) {
                const rect = element.getBoundingClientRect();
                const styles = window.getComputedStyle(element);
                if (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  styles.display !== "none" &&
                  styles.visibility !== "hidden"
                ) {
                  frameworkErrors.push(
                    (element.textContent || selector).trim().slice(0, 300)
                  );
                }
              }
            }

            const meaningfulTextLength = (body?.innerText || "")
              .replace(/\s+/g, " ")
              .trim().length;

            return {
              scrollWidth,
              clientWidth,
              overflow,
              overflowingElements,
              brokenImages,
              frameworkErrors,
              meaningfulTextLength,
            };
          });

          const key = `${vp.label}_${theme}`;
          const isOverflowing = metrics.overflow > 2;

          auditResults.routeResults[route].viewports[key] = {
            viewport: vp.label,
            theme,
            overflow: metrics.overflow,
            overflowingElements: metrics.overflowingElements,
            brokenImages: metrics.brokenImages,
            frameworkErrors: metrics.frameworkErrors,
            meaningfulTextLength: metrics.meaningfulTextLength,
          };

          if (isOverflowing) {
            const finding = `[OVERFLOW] ${route} on ${vp.label} (${theme}): ${metrics.overflow}px overflow. Elements: ${JSON.stringify(metrics.overflowingElements)}`;
            console.error(`  ${finding}`);
            auditResults.findings.push(finding);
          }

          if (metrics.brokenImages.length > 0) {
            const finding = `[BROKEN_IMAGE] ${route} on ${vp.label}: ${metrics.brokenImages.join(", ")}`;
            console.error(`  ${finding}`);
            auditResults.findings.push(finding);
          }

          if (metrics.frameworkErrors.length > 0) {
            const finding = `[FRAMEWORK_ERROR] ${route} on ${vp.label} (${theme}): ${metrics.frameworkErrors.join(" | ")}`;
            console.error(`  ${finding}`);
            auditResults.findings.push(finding);
          }

          if (metrics.meaningfulTextLength < 20) {
            const finding = `[BLANK_PAGE] ${route} on ${vp.label} (${theme}): only ${metrics.meaningfulTextLength} visible text characters`;
            console.error(`  ${finding}`);
            auditResults.findings.push(finding);
          }

          // Capture full-length screenshot for all viewports and themes
          const snapshotFile = path.join(routeOutputDir, `${vp.label}_${theme}.png`);
          await page.screenshot({ path: snapshotFile, fullPage: true });
        }
      }

      const routeFindings = auditResults.findings.slice(findingStart);
      const routeConsoleErrors = consoleErrors.slice(consoleErrorStart);
      const routePageErrors = pageErrors.slice(pageErrorStart);
      Object.assign(auditResults.routeResults[route], {
        consoleErrors: routeConsoleErrors,
        pageErrors: routePageErrors,
      });

      if (
        hasPortalAuditFailures({
          findings: routeFindings,
          consoleErrors: routeConsoleErrors,
          pageErrors: routePageErrors,
        })
      ) {
        auditResults.routeResults[route].status = "fail";
        auditResults.routeResults[route].errors.push(
          `${routeFindings.length} finding(s), ${routeConsoleErrors.length} console error(s), ${routePageErrors.length} page error(s)`
        );
        console.error(` ${route} FAIL across one or more viewports`);
      } else {
        auditResults.routesVerified++;
        auditResults.routeResults[route].status = redirected
          ? "redirect-verified"
          : "verified";
        console.log(` ${route} PASS across all viewports`);
      }
    } catch (err) {
      console.error(` ${route} FAIL: ${err.message}`);
      auditResults.routeResults[route].status = "fail";
      auditResults.routeResults[route].errors.push(err.message);
      auditResults.findings.push(`[ROUTE_ERROR] ${route}: ${err.message}`);
    } finally {
      auditResults.routesChecked++;
    }
  }

  await browser.close();

  auditResults.consoleErrors = consoleErrors;
  auditResults.pageErrors = pageErrors;
  const reportPath = path.join(
    OUTPUT_BASE,
    `portal-audit-report-${role}-${runMode}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2), "utf8");
  console.log(`\nAudit Report saved to: ${reportPath}`);

  // Summary
  console.log("\n=================================");
  console.log("Portal UI Audit Summary");
  console.log("=================================");
  console.log(`Routes Checked: ${auditResults.routesChecked} / ${auditResults.routesRequested}`);
  console.log(`Console Errors: ${consoleErrors.length}`);
  console.log(`Page Errors: ${pageErrors.length}`);
  console.log(`Findings: ${auditResults.findings.length}`);

  if (consoleErrors.length > 0) {
    console.error("\nConsole Errors Encountered:");
    for (const ce of consoleErrors) {
      console.error(` - [${ce.route}] ${ce.text}`);
    }
  }

  if (pageErrors.length > 0) {
    console.error("\nUnhandled Page Errors Encountered:");
    for (const pe of pageErrors) {
      console.error(` - [${pe.route}] ${pe.message}`);
    }
  }

  const hasCriticalFailures = hasPortalAuditFailures({
    findings: auditResults.findings,
    consoleErrors,
    pageErrors,
  });

  if (hasCriticalFailures) {
    console.error("\nFAIL: Critical UI or runtime defects found during portal audit.");
    process.exit(1);
  }

  console.log("\nSUCCESS: All tested portal surfaces passed responsiveness, accessibility, and runtime checks.");
}

main().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
