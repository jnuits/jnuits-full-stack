import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT || "3100", 10);
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const fullMatrix = process.env.PLAYWRIGHT_FULL_MATRIX === "1";
const releaseSmoke = process.env.PLAYWRIGHT_RELEASE_SMOKE === "1";

const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1";
const localWebServer = externalBaseURL
  ? undefined
  : {
      command: process.env.CI
        ? `npm run start -- -p ${port}`
        : `npm run build && npm run start -- -p ${port}`,
      // Reusing a server while another build replaces .next can leave the page
      // pointing at missing client chunks. Opt in only for deliberate local QA.
      reuseExistingServer,
      timeout: 180_000,
      url: baseURL,
    };

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: "test-results/playwright",
  projects: fullMatrix
    ? [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
        {
          name: "mobile-chromium",
          use: { ...devices["Pixel 5"], viewport: { height: 812, width: 375 } },
        },
        {
          name: "tablet-chromium",
          use: { ...devices["Desktop Chrome"], viewport: { height: 1024, width: 768 } },
        },
      ]
    : releaseSmoke
      ? [
          { name: "chromium", use: { ...devices["Desktop Chrome"] } },
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ]
      : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: localWebServer,
  workers: process.env.CI ? 1 : undefined,
});