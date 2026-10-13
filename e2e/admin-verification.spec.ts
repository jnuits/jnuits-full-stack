import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const enabled = process.env.ADMIN_VERIFICATION_QA === "DISPOSABLE_SCRATCH";
const baseURL = "http://127.0.0.1:3127";
// Worker-scoped options must be top-level. Credentials never enter traces.
test.use({ trace: "off", screenshot: "off" });
type Account = { cookies: { name: string; value: string }[]; userId: string; password: string; factorId?: string };
async function fixture(action: string, input: Record<string, unknown> = {}) {
  const response = await fetch(`${process.env.ADMIN_VERIFICATION_QA_BRIDGE}/${action}`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.ADMIN_VERIFICATION_QA_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Disposable fixture failed (${action}, ${response.status}).`);
  return response.json();
}
async function signedIn(context: BrowserContext, name: string): Promise<Account> {
  const account = await fixture("account", { name });
  await context.addCookies(account.cookies.map((cookie: { name: string; value: string }) => ({ ...cookie, domain: "127.0.0.1", path: "/", sameSite: "Lax" })));
  return account;
}
async function verificationRequest(context: BrowserContext, data: Record<string, unknown>) {
  const response = await context.request.post(`${baseURL}/api/admin/verification`, { headers: { Origin: baseURL, "Sec-Fetch-Site": "same-origin" }, data });
  return response.json();
}
async function healthy(page: Page) {
  await expect(page.locator("body")).not.toContainText(/Runtime Error|Application error|Internal Server Error/);
  expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}
async function emailProof(context: BrowserContext, intent: Record<string, unknown>, name = "never") {
  const sent = await verificationRequest(context, { action: "email_send", intent });
  expect(sent.ok).toBe(true);
  const { code } = await fixture("email", { name });
  const verified = await verificationRequest(context, { action: "email_verify", challengeId: sent.value.challengeId, code });
  expect(verified.ok).toBe(true);
  return verified.value.token as string;
}

test.describe("disposable admin authorization integration", () => {
  test.skip(!enabled, "Run through the disposable admin verification runner; never use hosted credentials.");
  // These native fixtures mutate membership/roles. Replay requires a fresh stack.
  test.describe.configure({ mode: "serial", retries: 0 });
  test.setTimeout(120_000);
  test.beforeEach(async ({ page }) => {
    // No authenticated dashboard operation may depend on the public CAPTCHA.
    await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", route => route.abort("blockedbyclient"));
  });

  test("AAL1 routine and bulk approval preserve fees/freezes at mobile and desktop in both themes", async ({ page, context }) => {
    await signedIn(context, "never");
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    for (const width of [360, 1440]) for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem("jnuits-theme", value), theme);
      await page.goto(`${baseURL}/admin/membership?renewalQueue=alumni`, { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { name: "Renewal and membership decisions" })).toBeVisible();
      await expect(page.getByRole("checkbox", { name: "Select all on this page" })).toBeEnabled();
      await healthy(page);
      await page.screenshot({ path: `${process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS}/routine-${width}-${theme}.png`, fullPage: false });
    }
    const review = page.getByRole("button", { name: "Review request" }).first();
    await review.click();
    const single = page.getByRole("dialog", { name: "Review membership request" });
    await single.getByLabel("Review note").fill("Synthetic eligibility review.");
    await single.getByLabel("I understand this decision and its consequences.").check();
    await single.getByRole("button", { name: "Record decision" }).click();
    await expect(single).toContainText("approved");
    await expect(page.getByRole("dialog", { name: "Verify your account" })).toHaveCount(0);
    await single.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("checkbox", { name: "Select all on this page" }).check();
    await page.getByRole("button", { name: "Approve selected", exact: true }).click();
    const bulk = page.getByRole("dialog", { name: "Approve selected membership requests" });
    await expect(bulk.getByRole("button", { name: "Approve selected requests" })).toBeDisabled();
    await bulk.getByLabel("Bulk review note").fill("Synthetic bulk eligibility review.");
    await bulk.getByLabel(/understand these decisions/).check();
    await bulk.getByRole("button", { name: "Approve selected requests" }).click();
    await expect(bulk).toContainText("0 failed");
    await bulk.getByRole("button", { name: "Close bulk review" }).click();
    expect(await fixture("membership_state")).toEqual({ alumni: 3, frozen: 3, fees: 0, reviewed: 3 });
    expect(errors).toEqual([]);
  });

  test("sensitive content is hidden; email grants one named read and cannot authorize a write", async ({ page, context }) => {
    await signedIn(context, "never");
    await fixture("reset_limits", { name: "never" });
    for (const width of [360, 1440]) for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem("jnuits-theme", value), theme);
      await page.goto(`${baseURL}/admin/settings/security`, { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("button", { name: "Verify account", exact: true })).toBeVisible();
      await expect(page.getByRole("checkbox", { name: /Require/ })).toHaveCount(0);
      await healthy(page);
      await page.screenshot({ path: `${process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS}/protected-${width}-${theme}.png`, fullPage: false });
    }
    expect(await verificationRequest(context, { action: "prepare", intent: { operation: "admin.security.read", payload: {} } })).toMatchObject({ ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } });
    await page.getByRole("button", { name: "Verify account", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Verify your account" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Verify by email" })).toBeVisible();
    await dialog.getByRole("button", { name: "Verify by email" }).click();
    await expect(dialog.getByLabel("Email code")).toBeVisible();
    const { code } = await fixture("email", { name: "never" });
    await dialog.getByLabel("Email code").fill(code);
    await dialog.getByRole("button", { name: "Verify and continue" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Security settings/i })).toBeVisible();
    await page.goto(`${baseURL}/admin/system-health`, { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Verify account", exact: true })).toBeVisible();
    const state = await fixture("read_proof", { name: "never" });
    expect(state.reads).toBe(1);
    expect((await fixture("try_read_proof_write", { name: "never" })).allowed).toBe(false);
  });

  test("cancelled email verification preserves renewal draft; exact write proof is single-use", async ({ page, context }) => {
    await signedIn(context, "never");
    await fixture("reset_limits", { name: "never" });
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(`${baseURL}/admin/membership?renewalQueue=overdue`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Renewal and membership decisions" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Membership decisions are temporarily unavailable" })).toHaveCount(0);
    const reviewAnniversary = page.getByRole("button", { name: "Review anniversary" }).first();
    await expect(reviewAnniversary).toBeVisible();
    await reviewAnniversary.click();
    const renewal = page.getByRole("dialog", { name: "Confirm one anniversary" });
    await renewal.getByLabel("Review note").fill("Synthetic office payment checked.");
    await renewal.getByLabel(/confirm only this anniversary/).check();
    await renewal.getByRole("button", { name: "Confirm anniversary" }).click();
    const dialog = page.getByRole("dialog", { name: "Verify your account" });
    await expect(dialog.getByRole("button", { name: "Verify by email" })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel verification" }).focus();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("dialog")?.classList.contains("admin-verification-dialog"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(renewal.getByLabel("Review note")).toHaveValue("Synthetic office payment checked.");
    await expect(renewal.getByLabel(/confirm only this anniversary/)).toBeChecked();
    await renewal.getByRole("button", { name: "Confirm anniversary" }).click();
    await dialog.getByRole("button", { name: "Verify by email" }).click();
    await expect(dialog.getByLabel("Email code")).toBeVisible();
    const { code } = await fixture("email", { name: "never" });
    await dialog.getByLabel("Email code").fill(code);
    await healthy(page);
    await dialog.getByRole("button", { name: "Verify and continue" }).click();
    await expect(renewal.getByText(/^Confirmed one anniversary\./)).toBeVisible();
    expect(await fixture("renewal_state")).toEqual({ count: 1, frozen: true });
    await renewal.getByRole("button", { name: "Close", exact: true }).click();
    await fixture("reset_limits", { name: "never" });
    const intent = await fixture("renewal_intent");
    const token = await emailProof(context, intent);
    const request = { intent, token };
    expect((await fixture("renewal_rpc", { name: "never", ...request })).allowed).toBe(true);
    expect((await fixture("renewal_rpc", { name: "never", ...request })).allowed).toBe(false);
    expect(await fixture("renewal_state")).toEqual({ count: 2, frozen: true });
  });

  test("retention read expiry recovers in the mounted workspace without replaying discovery", async ({ page, context }) => {
    await signedIn(context, "never");
    await fixture("reset_limits", { name: "never" });
    await emailProof(context, { operation: "admin.retention.read", payload: {} });
    let reads = 0; let writes = 0; let expireReads = true;
    await page.route("**/api/admin/retention", async route => {
      if (route.request().method() === "GET") {
        reads++;
        // Expire only this synthetic actor's named proof, after the page's
        // server check. The endpoint response and new proof checks stay real.
        // Development Strict Mode can mount twice. Expire by recovery stage,
        // not request count, so the replacement proof is not expired again.
        if (expireReads) await fixture("expire_retention_read", { name: "never" });
      } else if (route.request().method() === "POST") writes++;
      await route.continue();
    });
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(`${baseURL}/admin/retention`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Verify to view this page" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Discover candidates" })).toHaveCount(0);
    async function verifyRead() {
      await fixture("reset_limits", { name: "never" }); // Accelerated expiry, not a production limiter bypass.
      await page.getByRole("button", { name: "Verify account", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Verify your account" });
      await dialog.getByRole("button", { name: "Verify by email" }).click();
      await expect(dialog.getByLabel("Email code")).toBeVisible();
      const { code } = await fixture("email", { name: "never" });
      await dialog.getByLabel("Email code").fill(code);
      await dialog.getByRole("button", { name: "Verify and continue" }).click();
      await expect(page.getByRole("heading", { name: "Data retention", exact: true })).toBeVisible();
    }
    const initialReads = reads;
    expireReads = false;
    await verifyRead();
    expect(reads).toBeGreaterThan(initialReads);
    await fixture("reset_limits", { name: "never" });
    expireReads = true;
    await page.getByRole("button", { name: "Discover candidates" }).click();
    const dialog = page.getByRole("dialog", { name: "Verify your account" });
    await dialog.getByRole("button", { name: "Verify by email" }).click();
    await expect(dialog.getByLabel("Email code")).toBeVisible();
    const { code } = await fixture("email", { name: "never" });
    await dialog.getByLabel("Email code").fill(code);
    await dialog.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page.getByRole("heading", { name: "Verify to view this page" })).toBeVisible();
    expect(await fixture("retention_discovery_state", { name: "never" })).toEqual({ completed: 1 });
    const postMutationReads = reads;
    expireReads = false;
    await verifyRead();
    expect(reads).toBeGreaterThan(postMutationReads); expect(writes).toBe(1);
    expect(await fixture("retention_discovery_state", { name: "never" })).toEqual({ completed: 1 });
    await healthy(page);
    await page.screenshot({ path: `${process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS}/retention-recovered-mobile.png`, fullPage: false });
  });

  test("native authenticator setup offers QR/manual entry and returns an AAL2 session to the requested queue", async ({ page, context }) => {
    const account = await signedIn(context, "setup");
    await fixture("policy", { enforced: true });
    try {
      await page.goto(`${baseURL}/admin/membership?renewalQueue=alumni`, { waitUntil: "networkidle" });
      await expect(page).toHaveURL(/\/admin\/mfa\/setup\?next=/);
      const setup = page.getByRole("heading", { name: "Set up MFA", exact: true });
      await expect(setup).toBeVisible();
      await expect(page.getByAltText("TOTP setup QR code")).toBeVisible();
      for (const width of [360, 1440]) for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        const themeToggle = page.locator(".admin-topbar").getByRole("button", { name: "Toggle color theme" });
        if (await themeToggle.getAttribute("aria-pressed") !== String(theme === "dark")) await themeToggle.click();
        await expect(themeToggle).toHaveAttribute("aria-pressed", String(theme === "dark"));
        const navigation = page.locator(".admin-sidebar");
        if (width === 360 && await navigation.getAttribute("data-open") === "true") {
          await page.getByRole("button", { name: "Close navigation", exact: true }).click();
        }
        await expect(navigation).toHaveAttribute("data-open", "false");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
        else await expect(page.locator("html")).not.toHaveClass(/dark/);
        await healthy(page);
        // QR encodes the native setup secret. Never put it in any artifact.
        await page.screenshot({ path: `${process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS}/mfa-setup-${width}-${theme}.png`, animations: "disabled", fullPage: true, mask: [page.getByAltText("TOTP setup QR code"), page.locator("code")] });
      }
      await page.getByRole("button", { name: "Can't scan? Show setup key" }).click();
      await page.screenshot({ path: `${process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS}/mfa-manual-entry.png`, fullPage: true, mask: [page.getByAltText("TOTP setup QR code"), page.locator("code")] });
      const secret = await page.locator("code").textContent();
      expect(Boolean(secret)).toBe(true);
      const { code } = await fixture("setup_totp", { name: "setup", secret });
      await page.getByRole("button", { name: "Hide setup key" }).click();
      await expect(page.locator("code")).toHaveCount(0);
      await page.getByLabel("Verification code").fill(code);
      await page.getByRole("button", { name: "Verify and continue" }).click();
      await expect(page).toHaveURL(`${baseURL}/admin/membership?renewalQueue=alumni`);
      expect((await fixture("session_assurance", { userId: account.userId })).aal).toBe("aal2");
      await healthy(page);
      await page.goto(`${baseURL}/admin/mfa/challenge?next=%2Fadmin%2Fsettings%2Fsecurity`, { waitUntil: "networkidle" });
      await page.getByLabel("Verification code").fill((await fixture("totp", { name: "setup" })).code);
      await page.getByRole("button", { name: "Verify and continue" }).click();
      await expect(page).toHaveURL(`${baseURL}/admin/settings/security`);
      await expect(page.getByRole("heading", { name: /Security settings/i })).toBeVisible();
    } finally { await fixture("policy", { enforced: false }); }
  });

  test("voluntary authenticator works while enforcement is off; mandatory policy never permits email", async ({ page, context }) => {
    const account = await signedIn(context, "voluntary");
    await page.goto(`${baseURL}/admin/settings/security`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Verify account", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Verify your account" });
    await expect(dialog.getByRole("button", { name: "Verify by email" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Verify authenticator" }).click();
    await expect(dialog.getByLabel("Authenticator code")).toBeVisible();
    const { code } = await fixture("totp", { name: "voluntary" });
    await dialog.getByLabel("Authenticator code").fill(code);
    await dialog.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page.getByRole("heading", { name: /Security settings/i })).toBeVisible();
    expect((await fixture("session_assurance", { userId: account.userId })).aal).toBe("aal2");
    await fixture("policy", { enforced: true });
    try {
      // Production Auth cookies are Secure. Chromium accepts them on loopback,
      // while Playwright's HTTP API client omits them; use the actual browser.
      const response = await page.evaluate(async () => {
        const result = await fetch("/api/admin/verification", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "prepare", intent: { operation: "admin.security.read", payload: {} } }) });
        return { status: result.status, body: await result.json() };
      });
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true); expect(response.body.value.decision.status).toBe("allowed");
      await context.clearCookies(); await signedIn(context, "never");
      const denied = await verificationRequest(context, { action: "email_send", intent: { operation: "admin.security.read", payload: {} } });
      expect(denied.ok).toBe(false);
      await page.goto(`${baseURL}/admin/membership`, { waitUntil: "networkidle" });
      await expect(page).toHaveURL(/\/admin\/mfa\/setup/);
    } finally { await fixture("policy", { enforced: false }); }
  });

  test("admin-role operation rejects email/MFA-only and requires current-password without dashboard CAPTCHA", async ({ page, context }) => {
    const account = await signedIn(context, "super");
    const intent = await fixture("role_intent");
    expect((await verificationRequest(context, { action: "email_send", intent })).ok).toBe(false);
    expect((await fixture("role_rpc", { name: "super", intent })).allowed).toBe(false);
    expect((await verificationRequest(context, { action: "password_verify", intent, password: "" })).ok).toBe(false);
    await page.goto(`${baseURL}/admin/admin-profiles?profile=${encodeURIComponent(intent.payload.adminProfileId)}`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("Synthetic Target");
    // The actual UI must work with the provider blocked. Native MFA and the
    // current password still authorize an exact, single-use operation proof.
    const target = page.locator("form").filter({ has: page.locator('input[name="adminProfileId"]') }).filter({ has: page.locator('input[name="adminProfileId"][value="'+intent.payload.adminProfileId+'"]') });
    const change = target.filter({ has: page.locator('select[name="roleCode"]') }).first();
    await change.locator('select[name="roleCode"]').selectOption("admin");
    await change.locator('input[name="confirmation"]').fill(intent.payload.confirmation);
    await change.getByRole("button", { name: /role/i }).click();
    // A viewport modal must stay reachable even if its local panel shrinks.
    // Only the disposable fixture is constrained; product CSS stays intact.
    await change.evaluate(form => {
      form.style.transform = "translateY(0px)";
      form.style.overflow = "hidden";
      form.style.maxHeight = "40px";
    });
    const confirmation = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Change admin role?" }) });
    await expect(confirmation.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirmation.getByRole("button", { name: "Change role", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(confirmation.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await confirmation.getByRole("button", { name: "Change role", exact: true }).click({ timeout: 10_000 });
    await change.evaluate(form => {
      form.style.transform = ""; form.style.overflow = ""; form.style.maxHeight = "";
    });
    const dialog = page.getByRole("dialog", { name: "Verify your account" });
    await expect(dialog.getByLabel("Current password")).toBeVisible();
    await expect(dialog.locator('[name="captchaToken"]')).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Verify by email" })).toHaveCount(0);
    await dialog.getByLabel("Current password").fill(account.password);
    await expect(dialog.getByRole("button", { name: "Verify password and continue" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancel verification" }).click();
    await expect(change.locator('[name="confirmation"]')).toHaveValue(intent.payload.confirmation);
    await change.getByRole("button", { name: /role/i }).click();
    await page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Change admin role?" }) }).getByRole("button", { name: "Change role", exact: true }).click({ timeout: 10_000 });
    await dialog.getByLabel("Current password").fill(account.password);
    await expect(dialog.getByRole("button", { name: "Verify password and continue" })).toBeEnabled();
    // One lost server-action request: preserve the form and force fresh
    // verification, never automatically retry an uncertain privileged action.
    await page.route("**/admin/admin-profiles*", async route => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"]) await route.abort("failed");
      else await route.continue();
    });
    await dialog.getByRole("button", { name: "Verify password and continue" }).click();
    await expect(change.getByRole("alert")).toContainText(/check.*before.*trying again/i);
    await expect(change.locator('[name="confirmation"]')).toHaveValue(intent.payload.confirmation);
    expect((await fixture("target_role")).role).toBe("content_admin");
    await page.unroute("**/admin/admin-profiles*");
    await change.getByRole("button", { name: /role/i }).click();
    await page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Change admin role?" }) }).getByRole("button", { name: "Change role", exact: true }).click({ timeout: 10_000 });
    await dialog.getByLabel("Current password").fill(account.password);
    await expect(dialog.getByRole("button", { name: "Verify password and continue" })).toBeEnabled();
    // Retain only the response in memory for a replay-denial assertion. Never
    // attach network bodies, credentials or this secret to logs/artifacts.
    const response = page.waitForResponse(value => value.url().endsWith("/api/admin/verification") && value.request().postDataJSON()?.action === "password_verify");
    await dialog.getByRole("button", { name: "Verify password and continue" }).click();
    const proof = await (await response).json();
    expect(proof.ok).toBe(true);
    await expect.poll(async () => (await fixture("target_role")).role).toBe("admin");
    await expect(dialog).toHaveCount(0);
    expect((await fixture("role_rpc", { name: "super", intent, token: proof.value.token })).allowed).toBe(false);
    expect((await fixture("target_role")).role).toBe("admin");
    expect((await fixture("session_assurance", { userId: account.userId })).aal).toBe("aal2");
    await healthy(page);
  });
});
