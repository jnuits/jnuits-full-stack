import { expect, test } from "@playwright/test";

const enabled = process.env.ADMIN_VERIFICATION_QA === "DISPOSABLE_SCRATCH" && process.env.PROFILE_SELF_SERVICE_QA === "DISPOSABLE_SCRATCH" && process.env.MEMBER_EDITOR_QA === "DISPOSABLE_SCRATCH";
const baseURL = "http://127.0.0.1:3127";
test.use({ trace: "off", screenshot: "off", actionTimeout: 15_000, navigationTimeout: 45_000 });

async function fixture(action: string, input: Record<string, unknown> = {}) {
  const response = await fetch(`${process.env.ADMIN_VERIFICATION_QA_BRIDGE}/${action}`, { method: "POST", headers: { Authorization: `Bearer ${process.env.ADMIN_VERIFICATION_QA_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error("Disposable fixture rejected the operation.");
  return response.json();
}

test.describe("isolated responsive member editor", () => {
  test.skip(!enabled, "Requires the disposable Auth/Postgres runner; no hosted users.");
  test.setTimeout(240_000);
  test("modal focus, themes, draft protection and real profile save", async ({ page, context, browserName }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const account = await fixture("account", { name: "never" });
    await context.addCookies(account.cookies.map((cookie: { name: string; value: string }) => ({ ...cookie, domain: "127.0.0.1", path: "/", sameSite: "Lax" })));
    for (const width of [375, 768, 1280]) for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem("jnuits-theme", value), theme);
      await page.goto(`${baseURL}/admin/membership`, { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const opener = page.getByRole("button", { name: "Edit Synthetic Profile Alumni", exact: true });
      await opener.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Edit Synthetic Profile Alumni", exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "Edit Synthetic Profile Alumni", exact: true })).toBeFocused();
      expect(await dialog.evaluate(element => element.matches(":modal"))).toBe(true);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
      expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
      const rect = await dialog.boundingBox();
      expect(rect?.width).toBeLessThanOrEqual(width);
      if (width === 375) expect(Math.round(rect!.width)).toBe(width);
      for (let count = 0; count < 40; count++) {
        await page.keyboard.press("Tab");
        expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
      }
      await dialog.getByLabel("Full name", { exact: true }).fill("Synthetic Unsaved Name");
      await page.keyboard.press("Escape");
      const confirmation = page.getByRole("alertdialog", { name: "Discard unsaved changes?" });
      await expect(confirmation).toBeVisible();
      await expect(confirmation.getByRole("button", { name: "Keep editing", exact: true })).toBeFocused();
      await confirmation.getByRole("button", { name: "Keep editing", exact: true }).click();
      await expect(dialog.getByLabel("Full name", { exact: true })).toHaveValue("Synthetic Unsaved Name");
      await dialog.getByLabel("Full name", { exact: true }).fill("Synthetic Profile Alumni");
      await dialog.getByRole("heading", { name: "Edit Synthetic Profile Alumni", exact: true }).focus();
      await page.screenshot({ path: `${process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS}/member-editor-${browserName}-${width}-${theme}.png`, fullPage: false });
      await dialog.getByRole("button", { name: "Close member editor", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    }

    // Exercise a real authenticated Server Action only against the synthetic profile.
    await page.getByRole("button", { name: "Edit Synthetic Profile Alumni", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit Synthetic Profile Alumni", exact: true });
    await dialog.getByRole("combobox", { name: "Lifecycle", exact: true }).selectOption("current");
    const phone = browserName === "chromium" ? "01700000011" : browserName === "firefox" ? "01700000012" : "01700000013";
    await dialog.getByLabel("Phone", { exact: true }).fill(phone);
    await dialog.getByLabel("Audit note", { exact: true }).fill("Synthetic editor acceptance only.");
    await page.route("**/admin/membership*", async route => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"]) await new Promise(resolve => setTimeout(resolve, 1500));
      await route.continue();
    });
    await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Close member editor", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".portal-message--success")).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole("combobox", { name: "Lifecycle", exact: true })).toHaveValue("current");
    expect((await fixture("profile_state")).phone?.replace(/[^0-9]/g, "").endsWith(phone.slice(1))).toBe(true);
    await dialog.getByRole("button", { name: "Close member editor", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Discard changes", exact: true }).click();
    await page.getByRole("button", { name: "Edit Synthetic Profile Alumni", exact: true }).click();
    await expect(dialog.getByRole("combobox", { name: "Lifecycle", exact: true })).toHaveValue("alumni");
    await dialog.getByRole("button", { name: "Close member editor", exact: true }).click();
    expect(errors).toEqual([]);
  });
});
