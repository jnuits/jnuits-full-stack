import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT || "3100", 10);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const fullMatrix = process.env.PLAYWRIGHT_FULL_MATRIX === "1";

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
  webServer: {
    command: process.env.CI
      ? `npm run start -- -p ${port}`
      : `npm run build && npm run start -- -p ${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: baseURL,
  },
  workers: process.env.CI ? 1 : undefined,
});