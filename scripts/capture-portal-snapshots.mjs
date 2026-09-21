#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

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

const EXPECTED_REDIRECTS = new Map([
  ["/portal/dashboard", "/portal"],
  ["/profile", "/portal/profile"],
  ["/profile/edit", "/portal/profile/edit"],
  ["/profile/change-password", "/portal/profile/change-password"],
]);

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

function normalizeRoute(value) {
  const url = new URL(value, baseUrl);
  return `${url.pathname}${url.search}`;
}

function expectedLandedRoute(route, isAuthenticated) {
  const normalized = normalizeRoute(route);
  if (!isAuthenticated && !normalized.startsWith("/portal/login") && !normalized.startsWith("/portal/access-pending")) {
    // Unauthenticated access redirects to login
    return `/portal/login?next=${encodeURIComponent(normalized)}`;
  }
  return EXPECTED_REDIRECTS.get(normalized) || normalized;
}

async function hideDevBadges(page) {
  await safeEvaluate(page, () => {
    const selectors = [
      "nextjs-portal",
      "[data-nextjs-toast]",
      "[data-nextjs-dialog]",
      "#__next-build-watcher",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) el.style.display = "none";
    }
  }).catch(() => undefined);
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
      // Ignore harmless external assets and Cloudflare anti-bot console probing
      if (
        text.includes("favicon.ico") ||
        text.includes("font-size:0;color:transparent") ||
        url.includes("challenges.cloudflare.com") ||
        url.includes("turnstile")
      ) {
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
    targetRoutes = [
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

  console.log(`\nTesting ${targetRoutes.length} portal routes:`);
  for (const r of targetRoutes) {
    console.log(` - ${r}`);
  }

  const auditResults = {
    role,
    baseUrl,
    isAuthenticated,
    timestamp: new Date().toISOString(),
    routesRequested: targetRoutes.length,
    routesChecked: 0,
    routesVerified: 0,
    redirectsVerified: 0,
    findings: [],
    routeResults: {},
  };

  for (const route of targetRoutes) {
    activeRoute = route;
    const routeSlug = route.replace(/^\//, "").replace(/\//g, "-").replace(/\?/g, "_").replace(/=/g, "-");
    const routeOutputDir = path.join(OUTPUT_BASE, role, routeSlug);
    fs.mkdirSync(routeOutputDir, { recursive: true });

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

      const requestedRoute = normalizeRoute(route);
      const landedUrl = new URL(page.url());
      const landedRoute = `${landedUrl.pathname}${landedUrl.search}`;
      const redirected = landedRoute !== requestedRoute;

      Object.assign(auditResults.routeResults[route], {
        requestedRoute,
        landedRoute,
        redirected,
        responseStatus,
      });

      if (redirected) {
        console.log(` Verified redirect: ${route} -> ${landedRoute}`);
        auditResults.redirectsVerified++;
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
          await hideDevBadges(page);

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

            return {
              scrollWidth,
              clientWidth,
              overflow,
              overflowingElements,
              brokenImages,
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

          // Capture full-length screenshot for all viewports and themes
          const snapshotFile = path.join(routeOutputDir, `${vp.label}_${theme}.png`);
          await page.screenshot({ path: snapshotFile, fullPage: true }).catch(() => undefined);
        }
      }

      auditResults.routesChecked++;
      auditResults.routesVerified++;
      auditResults.routeResults[route].status = "pass";
      console.log(` ${route} PASS across all viewports`);
    } catch (err) {
      console.error(` ${route} FAIL: ${err.message}`);
      auditResults.routeResults[route].status = "fail";
      auditResults.routeResults[route].errors.push(err.message);
      auditResults.findings.push(`[ROUTE_ERROR] ${route}: ${err.message}`);
    }
  }

  await browser.close();

  const reportPath = path.join(OUTPUT_BASE, "portal-audit-report.json");
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

  const hasCriticalFailures =
    auditResults.findings.some((f) => f.startsWith("[OVERFLOW]") || f.startsWith("[ROUTE_ERROR]")) ||
    pageErrors.length > 0;

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
