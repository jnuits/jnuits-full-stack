import { expect, test, type Page } from "@playwright/test";

// UI contract evidence only: all mail/CAPTCHA responses are disposable fixtures.
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.JNUITS_PUBLIC_BROWSER_FIXTURES !== "1",
  "Newsletter UI fixtures require the managed local CI server; never run against production.");

async function fixtureCaptcha(page: Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", route => route.fulfill({
    contentType: "application/javascript",
    body: 'window.turnstile={render:function(el,options){setTimeout(function(){options.callback("fixture-captcha")},0);return "fixture-widget"},remove:function(){},reset:function(){}};',
  }));
}

test("newsletter consent, pending, readable error, retry focus and generic acceptance", async ({ page }) => {
  await fixtureCaptcha(page);
  let complete!: () => void;
  const pending = new Promise<void>(resolve => { complete = resolve; });
  let calls = 0;
  await page.route("**/api/newsletter/subscribe", async route => {
    calls++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toMatchObject({ email: "audit@example.test", consent: true, website: "" });
    if (calls === 1) await pending;
    await route.fulfill({ status: calls === 1 ? 400 : 202, json: calls === 1 ? { error: "captcha_failed" } : { status: "accepted" } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const form = page.locator("footer");
  const email = form.locator("#footer-newsletter-email");
  const consent = form.locator("#footer-newsletter-consent");
  const submit = form.locator('button[type="submit"]');
  await expect(consent).not.toBeChecked();
  await expect(submit).toBeDisabled();
  await email.fill("audit@example.test");
  await consent.check();
  await expect(submit).toBeEnabled();
  await submit.click();
  try {
    await expect(submit).toBeDisabled();
    await expect(form).toContainText(/subscribing/i);
  } finally { complete(); }
  await expect(form.getByRole("alert")).toContainText("Security verification failed");
  await form.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(email).toBeFocused();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(form.getByRole("status")).toContainText("If this email is eligible");
  await expect(form.getByRole("status")).not.toContainText("has been sent");
  expect(calls).toBe(2);
});

for (const result of [
  { status: 400, error: "invalid_token", heading: "Invalid confirmation link" },
  { status: 410, error: "expired_token", heading: "Confirmation link expired" },
  { status: 503, error: "newsletter_unavailable", heading: "Service temporarily unavailable" },
  { status: 200, payload: "confirmed", heading: "Subscription confirmed!" },
  { status: 200, payload: "preferences_required", heading: "Preferences update required" },
]) {
  test(`explicit newsletter confirmation renders ${result.error || result.payload}`, async ({ page }) => {
    await fixtureCaptcha(page);
    let calls = 0;
    await page.route("**/api/newsletter/confirm", route => {
      calls++;
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({ token: "disposable-confirmation-fixture" });
      return route.fulfill({ status: result.status, json: result.error ? { error: result.error } : { status: result.payload } });
    });
    await page.goto("/newsletter/confirm?token=disposable-confirmation-fixture", { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: "Confirm subscription", exact: true });
    await expect(button).toBeVisible();
    await expect(page).toHaveURL(/\/newsletter\/confirm$/);
    expect(calls).toBe(0);
    await button.click();
    await expect(page.getByRole("heading", { name: result.heading, exact: true })).toBeVisible();
    expect(calls).toBe(1);
    await expect(page.locator("main#main-content")).toHaveCount(1);
  });
}

test("event newsletter anchors transfer focus through pointer and keyboard activation", async ({page}) => {
  await fixtureCaptcha(page);
  for (const interaction of ["pointer","keyboard"]) {
    await page.goto("/events",{waitUntil:"domcontentloaded"});
    const anchor=page.locator('a[href="#footer-newsletter-email"]').first();
    if (interaction==="pointer") await anchor.click();
    else { await anchor.focus(); await page.keyboard.press("Enter"); }
    await expect(page.locator("#footer-newsletter-email")).toBeFocused();
  }
});
test("the public skip link receives first Tab and focuses the main landmark", async ({page}) => {
  await fixtureCaptcha(page);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await page.keyboard.press("Tab");
  await expect(page.locator(".public-skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
});
