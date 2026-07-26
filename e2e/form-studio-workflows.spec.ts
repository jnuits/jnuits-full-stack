import { expect, test, type Page } from "@playwright/test";

/**
 * Browser evidence for the Form Studio rebuilt in this branch.
 *
 * Gated behind E2E_AUTH_SMOKE=1 so CI skips it honestly rather than reporting a
 * false pass. A skip is blocked evidence, not passing evidence.
 */
const enabled = process.env.E2E_AUTH_SMOKE === "1";

const adminAccount = {
  email: process.env.E2E_NORMAL_ADMIN_EMAIL,
  password: process.env.E2E_NORMAL_ADMIN_PASSWORD,
};

const STUDIO = "/admin/content/forms";

function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1_000).toString(36)}`;
}

async function signInAsAdmin(page: Page) {
  if (!adminAccount.email || !adminAccount.password) {
    throw new Error("Set E2E_NORMAL_ADMIN_EMAIL and E2E_NORMAL_ADMIN_PASSWORD.");
  }

  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  await page.locator("#admin-login-email").fill(adminAccount.email);
  await page.locator("#admin-login-password").fill(adminAccount.password);
  await page.getByRole("button", { name: "Sign in to admin" }).click();
  await page.waitForURL(
    (url) =>
      /\/admin(?:\/dashboard)?(?:\?|$)/.test(`${url.pathname}${url.search}`) ||
      url.pathname.startsWith("/admin/mfa"),
    { timeout: 30_000 }
  );

  return !page.url().includes("/admin/mfa");
}

/** The builder hides identifiers behind a disclosure; this reads one out. */
async function readFieldId(page: Page, index: number) {
  const question = page.locator("article", { hasText: "Advanced details" }).nth(index);
  await question.getByRole("group").locator("summary").click();
  const text = await question.locator("code").innerText();
  return text.replace(/^ID:\s*/, "").trim();
}

function questionInput(page: Page, index: number) {
  return page.getByLabel("Question", { exact: true }).nth(index);
}

/** Creates and publishes a form, returning its public slug. */
async function publishForm(page: Page, title: string) {
  await page.goto(STUDIO, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Form title").fill(title);
  const slug = await page.getByLabel("Public address").inputValue();

  await page.getByRole("button", { name: /Create draft/ }).click();
  await expect(page.getByRole("status")).toContainText(/Draft saved/i, { timeout: 20_000 });

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: /^Publish$/ }).click();
  await expect(page.getByRole("status")).toContainText(/Form published/i, { timeout: 20_000 });

  return slug;
}

test.describe("Form Studio authenticated workflows", () => {
  test.skip(!enabled, "Set E2E_AUTH_SMOKE=1 with non-production credentials to run Form Studio checks.");

  test("generates readable field IDs from labels and freezes them after saving", async ({ page }) => {
    if (!(await signInAsAdmin(page))) test.skip(true, "Account requires MFA onboarding.");

    const suffix = uniqueSuffix();
    await page.goto(STUDIO, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Form Studio" })).toBeVisible();

    await page.getByLabel("Form title").fill(`Studio identity ${suffix}`);
    await page.getByRole("button", { name: "Add question" }).click();

    const lastIndex = (await page.getByLabel("Question", { exact: true }).count()) - 1;
    await questionInput(page, lastIndex).fill("Emergency contact");

    // F4: the old builder persisted the literal "new_question" regardless of
    // what the operator typed.
    expect(await readFieldId(page, lastIndex)).toBe("emergency_contact");

    await page.getByRole("button", { name: /Create draft/ }).click();
    await expect(page.getByRole("status")).toContainText(/Draft saved/i, { timeout: 20_000 });

    // Persisted identifiers must survive relabelling, or existing submissions
    // would lose their answer keys.
    await questionInput(page, lastIndex).fill("Primary contact");
    expect(await readFieldId(page, lastIndex)).toBe("emergency_contact");
  });

  test("duplicating a question mints a fresh identifier and reordering keeps them stable", async ({ page }) => {
    if (!(await signInAsAdmin(page))) test.skip(true, "Account requires MFA onboarding.");

    await page.goto(STUDIO, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Add question" }).click();

    const index = (await page.getByLabel("Question", { exact: true }).count()) - 1;
    await questionInput(page, index).fill("Dietary requirement");
    const originalId = await readFieldId(page, index);

    await page
      .locator("article", { hasText: "Advanced details" })
      .nth(index)
      .getByRole("button", { name: "Duplicate" })
      .click();

    const duplicateId = await readFieldId(page, index + 1);
    expect(duplicateId).not.toBe(originalId);
    expect(await readFieldId(page, index)).toBe(originalId);

    await page.getByRole("button", { name: "Move Dietary requirement up" }).first().click();
    expect(await readFieldId(page, index - 1)).toBe(originalId);
  });

  test("preview renders the real respondent controls, inert", async ({ page }) => {
    if (!(await signInAsAdmin(page))) test.skip(true, "Account requires MFA onboarding.");

    await page.goto(STUDIO, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Preview$/ }).click();

    const preview = page.getByRole("region", { name: "Form preview" });
    await expect(preview).toBeVisible();

    // The preview previously showed "Full name / Short answer" rather than the
    // control a respondent actually gets, so a wrong field type was invisible.
    const name = preview.locator("#form-studio-preview-full_name");
    const email = preview.locator("#form-studio-preview-email");
    await expect(name).toHaveAttribute("type", "text");
    await expect(email).toHaveAttribute("type", "email");

    // Inert: nothing in a preview may be typed into or submitted.
    for (const control of await preview.locator("input, select, textarea").all()) {
      await expect(control).toBeDisabled();
      expect(await control.getAttribute("name")).toBeNull();
    }

    await page.getByRole("button", { name: "Hide preview" }).click();
    await expect(preview).toBeHidden();
  });

  test("preview shows dropdown choices and reports an invalid definition", async ({ page }) => {
    if (!(await signInAsAdmin(page))) test.skip(true, "Account requires MFA onboarding.");

    await page.goto(STUDIO, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Add question" }).click();

    const index = (await page.getByLabel("Question", { exact: true }).count()) - 1;
    await questionInput(page, index).fill("Preferred track");
    await page.getByLabel("Question type").nth(index).selectOption("select");
    await page.getByRole("button", { name: /^Preview$/ }).click();

    const preview = page.getByRole("region", { name: "Form preview" });

    // A dropdown with no choices is invalid, and the preview now says so rather
    // than letting the operator discover it on save.
    await expect(preview.getByRole("alert")).toBeVisible();

    await page.getByLabel("Choices, one per line").fill("Web\nMobile");
    await expect(preview.locator("#form-studio-preview-preferred_track")).toBeVisible();
    await expect(preview.getByText("Mobile")).toBeVisible();
  });

  test("event registration offers titled events and never asks for a UUID", async ({ page }) => {
    if (!(await signInAsAdmin(page))) test.skip(true, "Account requires MFA onboarding.");

    await page.goto(STUDIO, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Form type").selectOption("event_registration");

    const selector = page.getByLabel("Linked event");
    await expect(selector).toBeVisible();

    // F5: the placeholder previously asked operators to paste an event ID.
    await expect(page.getByPlaceholder(/paste the event ID/i)).toHaveCount(0);
    await expect(selector).toHaveJSProperty("tagName", "SELECT");

    const options = await selector.locator("option").allInnerTexts();
    expect(options[0]).toMatch(/Choose an event/i);
    for (const option of options.slice(1)) {
      expect(option).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
    }
  });

  test("publishing clears the draft and exposes preview and share actions", async ({ page }) => {
    if (!(await signInAsAdmin(page))) test.skip(true, "Account requires MFA onboarding.");

    const title = `Studio publish ${uniqueSuffix()}`;
    const slug = await publishForm(page, title);

    // F10: the draft used to persist, leaving Publish live and the next save
    // patching an immutable published version.
    await expect(page.getByRole("button", { name: /^Publish$/ })).toHaveCount(0);

    const card = page.locator("article", { hasText: title });
    await expect(card.getByRole("link", { name: "Preview" })).toHaveAttribute("href", `/forms/${slug}`);
    await expect(card.getByRole("button", { name: /Share link/ })).toBeVisible();

    const publicResponse = await page.request.get(`/forms/${slug}`);
    expect(publicResponse.status()).toBe(200);
  });

  test("Review responses deep links into a loaded queue without typing an identifier", async ({ page }) => {
    if (!(await signInAsAdmin(page))) test.skip(true, "Account requires MFA onboarding.");

    await page.goto(STUDIO, { waitUntil: "domcontentloaded" });

    const reviewLink = page.getByRole("link", { name: "Review responses" }).first();
    if ((await reviewLink.count()) === 0) {
      test.skip(true, "No published form available to review.");
    }

    await reviewLink.click();
    await page.waitForURL(/\?review=/);

    // F6: the panel used to require pasting a form UUID into a text input.
    const picker = page.getByLabel("Form", { exact: true });
    await expect(picker).toHaveJSProperty("tagName", "SELECT");
    await expect(picker).not.toHaveValue("");
    await expect(page.getByText("Choose a form to review.")).toHaveCount(0);
  });

  test("studio, lifecycle, and review panels stay consistent after a lifecycle change", async ({ page }) => {
    if (!(await signInAsAdmin(page))) test.skip(true, "Account requires MFA onboarding.");

    await page.goto(STUDIO, { waitUntil: "domcontentloaded" });

    const closeButton = page.getByRole("button", { name: "Close intake" }).first();
    if ((await closeButton.count()) === 0) {
      test.skip(true, "No published form available to close.");
    }

    const card = page.locator("article").filter({ has: closeButton });
    const title = (await card.getByRole("heading").innerText()).trim();

    await closeButton.click();
    await expect(page.getByRole("status")).toContainText(/is now closed/i, { timeout: 20_000 });

    // Single shared inventory: the studio sidebar must reflect the change
    // without a manual reload.
    await expect(page.locator("aside").locator("article", { hasText: title })).toContainText("closed");
  });
});

test.describe("public form lifecycle gates", () => {
  test.skip(!enabled, "Set E2E_AUTH_SMOKE=1 to seed forms for the public gate checks.");

  test("a draft form is never publicly reachable", async ({ browser, page }) => {
    if (!(await signInAsAdmin(page))) test.skip(true, "Account requires MFA onboarding.");

    const suffix = uniqueSuffix();
    await page.goto(STUDIO, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Form title").fill(`Studio draft gate ${suffix}`);
    const slug = await page.getByLabel("Public address").inputValue();

    await page.getByRole("button", { name: /Create draft/ }).click();
    await expect(page.getByRole("status")).toContainText(/Draft saved/i, { timeout: 20_000 });

    const anonymous = await browser.newContext();
    const response = await anonymous.request.get(`/forms/${slug}`);
    expect(response.status()).toBe(404);
    await anonymous.close();
  });

  test("a published form renders publicly with CAPTCHA and no payment UI", async ({ browser, page }) => {
    if (!(await signInAsAdmin(page))) test.skip(true, "Account requires MFA onboarding.");

    const title = `Studio public gate ${uniqueSuffix()}`;
    const slug = await publishForm(page, title);

    const anonymous = await browser.newContext();
    const publicPage = await anonymous.newPage();
    await publicPage.goto(`/forms/${slug}`, { waitUntil: "domcontentloaded" });

    // The same renderer the preview used, now live: controls must be real.
    const email = publicPage.locator(`#form-${slug}-email`);
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toBeEnabled();
    await expect(email).toHaveAttribute("name", "email");

    // CAPTCHA protection must survive publication.
    await expect(
      publicPage.locator("[data-testid='captcha'], .cf-turnstile, iframe[src*='turnstile']")
    ).toHaveCount(1);

    // Payment is rejected server-side and must never surface publicly.
    await expect(publicPage.locator("body")).not.toContainText(/payment|pay now|amount due|bkash|nagad/i);

    await anonymous.close();
  });
});
