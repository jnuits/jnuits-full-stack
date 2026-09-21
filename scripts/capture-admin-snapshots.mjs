#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const OUTPUT_BASE = path.join(ROOT, "admin-snapshots");

const VIEWPORTS = [
  { width: 320, height: 640, label: "320px" },
  { width: 360, height: 740, label: "360px" },
  { width: 390, height: 844, label: "390px" },
  { width: 412, height: 915, label: "412px" },
  { width: 768, height: 1024, label: "768px" },
  { width: 1024, height: 768, label: "1024px" },
  { width: 1280, height: 800, label: "1280px" },
  { width: 1440, height: 900, label: "1440px" },
];

const THEMES = ["light", "dark"];

const email = process.env.ADMIN_EMAIL || process.env.E2E_NORMAL_ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD || process.env.E2E_NORMAL_ADMIN_PASSWORD;
const baseUrl = (process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100").replace(/\/$/, "");
const role = process.env.ADMIN_ROLE || (fs.existsSync(path.join(OUTPUT_BASE, "storage-state-normalAdmin.json")) ? "normalAdmin" : "admin");
const specificRoutesArg = process.env.ADMIN_ROUTES; // optional comma-separated routes
const EXPECTED_REDIRECTS = new Map([
  ["/admin/dashboard", "/admin"],
  ["/admin/settings", "/admin/admin-profiles?tab=self&profile=me"],
  ["/admin/settings/profile", "/admin/admin-profiles?tab=self&profile=me"],
]);

const storageStatePath = path.join(OUTPUT_BASE, `storage-state-${role}.json`);
const hasStorageState = fs.existsSync(storageStatePath);

if (!hasStorageState && (!email || !password)) {
  console.error("Error: Missing credentials and no existing session. Please provide ADMIN_EMAIL and ADMIN_PASSWORD via environment variables.");
  process.exit(1);
}

// Ensure artifacts output directory exists
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

function expectedLandedRoute(route) {
  const normalized = normalizeRoute(route);
  return EXPECTED_REDIRECTS.get(normalized) || normalized;
}

async function main() {
  console.log(`Starting Admin UI Snapshot Audit`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Role: ${role}`);
  console.log(`Output Directory: ${OUTPUT_BASE}`);

  const browser = await chromium.launch({
    headless: true,
  });

  let context;

  if (fs.existsSync(storageStatePath)) {
    try {
      context = await browser.newContext({
        storageState: storageStatePath,
        viewport: { width: 1440, height: 900 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JnUITS-UI-Audit",
      });
      const probePage = await context.newPage();
      await probePage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
      const currentUrl = probePage.url();
      if (currentUrl.includes("/admin/login")) {
        await context.close();
        context = null;
      } else {
        console.log(`Reusing authenticated session for ${role} (${currentUrl})`);
        await probePage.close();
      }
    } catch {
      context = null;
    }
  }

  if (!context) {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JnUITS-UI-Audit",
    });

    const loginPage = await context.newPage();
    console.log(`\n1. Authenticating as ${role}...`);
    await loginPage.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded" });

    await loginPage.locator("#admin-login-email").fill(email);
    await loginPage.locator("#admin-login-password").fill(password);
    await loginPage.getByRole("button", { name: "Sign in to admin" }).click();

    await loginPage.waitForURL(
      (url) => url.pathname.startsWith("/admin") && url.pathname !== "/admin/login",
      { timeout: 35000 }
    );
    console.log(`Current URL after login: ${loginPage.url()}`);
    await context.storageState({ path: storageStatePath });
    await loginPage.close();
  }

  const page = await context.newPage();
  let activeRoute = null;

  // Track console logs and errors
  const consoleMessages = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleMessages.push({
        route: activeRoute,
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
      });
    }
  });

  // Track page errors
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push({ route: activeRoute, message: err.message, stack: err.stack });
  });

  await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  const currentPath = new URL(page.url()).pathname;
  if (currentPath === "/admin/mfa/setup" || currentPath === "/admin/mfa/challenge") {
    console.log(`MFA onboarding detected at ${currentPath}`);
  }

  // 2. Discover available navigation routes from the sidebar
  let targetRoutes = [];
  if (specificRoutesArg) {
    targetRoutes = specificRoutesArg.split(",").map((r) => r.trim()).filter(Boolean);
  } else {
    // Collect all links inside the admin sidebar nav
    const sidebarLinks = await page.$$eval("aside.admin-sidebar nav a.admin-nav-link", (links) =>
      links.map((el) => el.getAttribute("href")).filter((href) => Boolean(href))
    );

    const discovered = [...new Set(sidebarLinks)];
    // Exclude committee route per parallel work agreement
    targetRoutes = discovered.filter((href) => !href.startsWith("/admin/committee"));

    // Ensure /admin is included
    if (!targetRoutes.includes("/admin")) {
      targetRoutes.unshift("/admin");
    }

    // Include nested sub-routes and hidden operational pages
    const subRoutes = [
      "/admin/dashboard",
      "/admin/applications",
      "/admin/membership",
      "/admin/profile-changes",
      "/admin/invitations",
      "/admin/decisions",
      "/admin/audit",
      "/admin/certificates",
      "/admin/bulk-operations",
      "/admin/reports",
      "/admin/retention",
      "/admin/reconcile",
      "/admin/system-health",
      "/admin/workplace",
      "/admin/settings",
      "/admin/settings/contact",
      "/admin/settings/notifications",
      "/admin/settings/profile",
      "/admin/settings/security",
      "/admin/admin-profiles?tab=self",
      "/admin/admin-profiles?tab=directory",
      "/admin/admin-profiles?tab=invitations",
      "/admin/admin-profiles?tab=access",
      "/admin/content",
      "/admin/content/about",
      "/admin/content/blogs",
      "/admin/content/events",
      "/admin/content/events/new",
      "/admin/content/forms",
      "/admin/content/gallery",
      "/admin/content/media",
      "/admin/content/notices",
      "/admin/content/notices/new",
      "/admin/content/pages",
      "/admin/content/projects",
      "/admin/content/slider",
    ];

    for (const sub of subRoutes) {
      if (!targetRoutes.includes(sub)) {
        targetRoutes.push(sub);
      }
    }
  }

  console.log(`\nDiscovered ${targetRoutes.length} admin routes for ${role}:`);
  for (const r of targetRoutes) {
    console.log(` - ${r}`);
  }

  const auditResults = {
    role,
    baseUrl,
    timestamp: new Date().toISOString(),
    routesRequested: targetRoutes.length,
    routesChecked: 0,
    routesVerified: 0,
    redirectsVerified: 0,
    findings: [],
    routeResults: {},
  };

  // 3. For each route, test viewports and themes
  for (const route of targetRoutes) {
    activeRoute = route;
    const consoleStart = consoleMessages.length;
    const pageErrorStart = pageErrors.length;
    const routeSlug = route === "/admin" ? "dashboard" : route.replace(/^\/admin\//, "").replace(/\//g, "-").replace(/\?/g, "_").replace(/=/g, "-");
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
        const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
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
      const expectedRoute = expectedLandedRoute(route);
      if (expectedRoute !== requestedRoute) {
        await page.waitForURL(
          (url) => `${url.pathname}${url.search}` === expectedRoute,
          { timeout: 10000 }
        );
      }
      const landedUrl = new URL(page.url());
      const landedRoute = `${landedUrl.pathname}${landedUrl.search}`;
      const redirected = landedRoute !== requestedRoute;
      Object.assign(auditResults.routeResults[route], {
        expectedRoute,
        landedRoute,
        redirected,
        responseStatus,
      });
      if (landedRoute !== expectedRoute) {
        throw new Error(
          `Unexpected redirect for ${route}: expected ${expectedRoute}, landed on ${landedRoute}`
        );
      }
      if (redirected) {
        console.log(` Verified redirect: ${route} -> ${landedRoute}`);
      }

      // Test each theme
      for (const theme of THEMES) {
        // Apply theme cleanly
        await safeEvaluate(page, (th) => {
          window.localStorage.setItem("jnuits-theme", th);
          document.documentElement.classList.toggle("dark", th === "dark");
          document.documentElement.dataset.theme = th;
          window.dispatchEvent(new Event("jnuits-theme-change"));
        }, theme);

        // Small wait for CSS variables / transitions to settle
        await page.waitForTimeout(150);

        // Test each viewport
        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.waitForTimeout(350);

          // Measure horizontal overflow
          const overflowMetrics = await safeEvaluate(page, () => {
            const root = document.documentElement;
            const body = document.body;
            const scrollWidth = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
            const clientWidth = root.clientWidth;
            const overflow = scrollWidth - clientWidth;

            // Find elements extending past the viewport
            const overflowingElements = [];
            const allElements = document.querySelectorAll("*");
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > clientWidth + 1) {
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

            // Check for broken images
            const brokenImages = [];
            const images = document.querySelectorAll("img");
            for (const img of images) {
              if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith("data:")) {
                brokenImages.push(img.src);
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

          const hasOverflow = overflowMetrics.overflow > 2;
          const hasBrokenImages = overflowMetrics.brokenImages && overflowMetrics.brokenImages.length > 0;
          const screenshotFileName = `${vp.label}_${theme}.png`;
          const screenshotFilePath = path.join(routeOutputDir, screenshotFileName);

          await page.screenshot({
            path: screenshotFilePath,
            fullPage: true,
          });

          // Cycle through tab buttons if present (e.g. AdminEditorTabs, GalleryAlbumTabs, sub-tab panels)
          if (theme === "dark" && (vp.label === "1440px" || vp.label === "360px")) {
            try {
              const tabButtons = await page.$$("button[role='tab'], .admin-editor-tabs__list button");
              if (tabButtons.length > 1) {
                for (let i = 0; i < tabButtons.length; i++) {
                  const tabBtn = tabButtons[i];
                  const isVisible = await tabBtn.isVisible().catch(() => false);
                  if (!isVisible) continue;
                  const rawText = (await tabBtn.textContent().catch(() => `tab_${i}`)) || `tab_${i}`;
                  const tabSlug = rawText
                    .trim()
                    .replace(/[^a-zA-Z0-9_-]/g, "_")
                    .toLowerCase()
                    .slice(0, 24);
                  await tabBtn.click({ force: true }).catch(() => undefined);
                  await page.waitForTimeout(200);
                  const tabScreenshotPath = path.join(routeOutputDir, `${vp.label}_${theme}_tab_${tabSlug}.png`);
                  await page.screenshot({
                    path: tabScreenshotPath,
                    fullPage: true,
                  });
                }
                // Return to first tab
                if (tabButtons[0]) {
                  await tabButtons[0].click({ force: true }).catch(() => undefined);
                  await page.waitForTimeout(150);
                }
              }
            } catch {
              // Ignore tab cycling errors
            }
          }

          const vpKey = `${vp.label}_${theme}`;
          auditResults.routeResults[route].viewports[vpKey] = {
            viewport: vp.label,
            width: vp.width,
            height: vp.height,
            theme,
            overflow: overflowMetrics.overflow,
            hasOverflow,
            screenshot: path.relative(ROOT, screenshotFilePath).replace(/\\/g, "/"),
          };

          if (hasOverflow) {
            const finding = {
              route,
              viewport: vp.label,
              theme,
              type: "HORIZONTAL_OVERFLOW",
              details: `Page overflow by ${overflowMetrics.overflow}px (scrollWidth: ${overflowMetrics.scrollWidth}px, clientWidth: ${overflowMetrics.clientWidth}px)`,
              elements: overflowMetrics.overflowingElements,
              screenshot: path.relative(ROOT, screenshotFilePath).replace(/\\/g, "/"),
            };
            auditResults.findings.push(finding);
            console.log(`   [!] OVERFLOW ${vp.label} (${theme}): +${overflowMetrics.overflow}px on ${route}`);
          }

          if (hasBrokenImages) {
            const imgFinding = {
              route,
              viewport: vp.label,
              theme,
              type: "BROKEN_IMAGE",
              details: `Found ${overflowMetrics.brokenImages.length} broken image(s): ${overflowMetrics.brokenImages.join(", ")}`,
              images: overflowMetrics.brokenImages,
              screenshot: path.relative(ROOT, screenshotFilePath).replace(/\\/g, "/"),
            };
            auditResults.findings.push(imgFinding);
            console.log(`   [!] BROKEN IMAGES on ${route} (${vp.label} ${theme}): ${overflowMetrics.brokenImages.length}`);
          }

          // On mobile 360px viewport, test opening and closing the mobile navigation drawer
          if (vp.label === "360px") {
            try {
              const toggleBtn = page.locator("#admin-sidebar-toggle");
              if (!(await toggleBtn.isVisible())) {
                throw new Error("Mobile sidebar toggle is not visible.");
              }
              await toggleBtn.click();
              await page.waitForTimeout(300);

              const drawerOpen = await safeEvaluate(page, () => {
                const s = document.querySelector(".admin-sidebar");
                return s ? s.getAttribute("data-open") === "true" : false;
              });
              if (!drawerOpen) {
                throw new Error("Mobile sidebar did not open.");
              }

              const drawerScreenshotPath = path.join(routeOutputDir, `${vp.label}_${theme}_sidebar_open.png`);
              await page.screenshot({ path: drawerScreenshotPath, fullPage: false });

              const closeBtn = page.locator(".admin-sidebar-close");
              if (await closeBtn.isVisible()) {
                await closeBtn.click();
              } else {
                await page.locator(".admin-sidebar-overlay").click({ force: true });
              }
              await page.waitForTimeout(300);

              const stillOpen = await safeEvaluate(page, () => {
                const s = document.querySelector(".admin-sidebar");
                return s ? s.getAttribute("data-open") === "true" : false;
              });
              if (stillOpen) {
                throw new Error("Mobile sidebar did not close.");
              }
            } catch (drawerErr) {
              throw new Error(
                `Drawer test failed for ${route} (${vp.label} ${theme}): ${drawerErr.message}`
              );
            }
          }
        }
      }

      const routeConsoleErrors = consoleMessages
        .slice(consoleStart)
        .filter((message) => message.type === "error");
      const routePageErrors = pageErrors.slice(pageErrorStart);
      if (routeConsoleErrors.length || routePageErrors.length) {
        throw new Error(
          `Runtime errors detected: ${routeConsoleErrors.length} console, ${routePageErrors.length} page`
        );
      }

      auditResults.routeResults[route].status = redirected
        ? "redirect-verified"
        : "verified";
      auditResults.routesChecked += 1;
      if (redirected) {
        auditResults.redirectsVerified += 1;
      } else {
        auditResults.routesVerified += 1;
      }
    } catch (err) {
      console.error(` Error on route ${route}:`, err.message);
      auditResults.routeResults[route].status = "failed";
      auditResults.routeResults[route].errors.push(err.message);
    }
  }

  // Record collected console errors & page errors
  auditResults.consoleErrors = consoleMessages.filter(
    (message) => message.type === "error"
  );
  auditResults.consoleWarnings = consoleMessages.filter(
    (message) => message.type === "warning"
  );
  auditResults.pageErrors = pageErrors;

  // Save JSON summary
  const summaryFile = path.join(OUTPUT_BASE, `audit-summary-${role}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(auditResults, null, 2), "utf8");
  console.log(`\nAudit finished! Summary saved to ${summaryFile}`);
  console.log(
    `Verified ${auditResults.routesVerified} routes and ${auditResults.redirectsVerified} redirects out of ${auditResults.routesRequested} requests.`
  );
  console.log(`Total overflow issues detected: ${auditResults.findings.length}`);

  await browser.close();

  const failedRoutes = Object.values(auditResults.routeResults).filter(
    (result) => result.status === "failed"
  );
  if (
    failedRoutes.length ||
    auditResults.findings.length ||
    auditResults.consoleErrors.length ||
    auditResults.pageErrors.length
  ) {
    throw new Error(
      `Admin UI audit failed: ${failedRoutes.length} routes, ${auditResults.findings.length} findings, ${auditResults.consoleErrors.length} console errors, ${auditResults.pageErrors.length} page errors.`
    );
  }
}

main().catch((err) => {
  console.error("Fatal audit failure:", err);
  process.exit(1);
});
