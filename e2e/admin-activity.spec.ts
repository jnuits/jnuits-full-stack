import { expect, test, type BrowserContext } from "@playwright/test";
import { join } from "node:path";
import { collectPageErrors }from"./helpers/page-errors";
const enabled = process.env.ADMIN_AUDIT_QA === "DISPOSABLE_SCRATCH";
const base = process.env.PROFILE_COMPLETION_QA_BASE_URL || "https://127.0.0.1:3130";
test.use({ trace: "off", screenshot: "off", ignoreHTTPSErrors: true, actionTimeout: 15_000 });
async function fixture(action: string, input: Record<string, unknown> = {}) {
  const response = await fetch(`${process.env.ADMIN_VERIFICATION_QA_BRIDGE}/${action}`, { method: "POST", headers: { Authorization: `Bearer ${process.env.ADMIN_VERIFICATION_QA_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  expect(response.ok).toBe(true); return response.json();
}
async function login(context: BrowserContext, name: string) {
  const account = await fixture("account", { name });
  await context.addCookies(account.cookies.map((cookie: { name: string; value: string }) => ({ ...cookie, domain: "127.0.0.1", path: "/", sameSite: "Lax" })));
  return account;
}
test.describe("trusted admin activity on real disposable Auth and Postgres", () => {
  test.skip(!enabled, "Only the isolated production-mode runner is authorized.");
  test.describe.configure({ mode: "serial", retries: 0 }); test.setTimeout(120_000);
  test.beforeEach(async () => { await fixture("activity_reset"); });
  test("read-only filters and paging work before application hydration",async({browser})=>{
    // Keep React's inline HTML stream insertion, but block application bundles.
    // Disabling the entire JS engine also disables the framework's HTML stream.
    const context=await browser.newContext({ignoreHTTPSErrors:true});
    let blockedBundles=0;
    await context.route("**/_next/static/**/*.js*",route=>{blockedBundles++;return route.abort("blockedbyclient");});
    try{
      await login(context,"never");const page=await context.newPage();
      await page.goto(base+"/admin/audit?view=activity&action=fixture.work");
      await expect(page.getByRole("heading",{name:"Admin activity",exact:true})).toBeVisible();
      const panel=page.getByTestId("admin-activity-panel");
      await panel.getByRole("link",{name:"Next",exact:true}).click();
      await expect(panel).toContainText("Page 2 of 6");
      await panel.getByRole("button",{name:"Apply filters",exact:true}).click();
      await expect(panel).toContainText("Page 1 of 6");
      expect(new URL(page.url()).searchParams.get("action")).toBe("fixture.work");
      expect(blockedBundles).toBeGreaterThan(0);
    }finally{await context.close();}
  });
  test("committed self-profile work, page receipts and native replay remain separate", async ({ page, context, browserName }) => {
    const account = await login(context, "activityreader");
    await page.goto(base + "/admin/settings/profile", {waitUntil:"networkidle"});
    const displayName="Synthetic activity reader "+browserName;
    await page.getByLabel("Display name", { exact: true }).fill(displayName);
    const saved=page.waitForResponse(response=>response.url().includes("/admin/settings/profile")&&response.request().method()==="POST");
    await page.getByRole("button", { name: "Save admin profile", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Admin profile updated" })).toBeVisible();
    await expect(page.getByLabel("Display name",{exact:true})).toHaveValue(displayName);
    await page.goto(base + "/admin/audit?view=activity&action=admin_profile.updated&actor=" + account.userId, {waitUntil:"networkidle"});
    const panel = page.getByTestId("admin-activity-panel");
    await expect(panel).toContainText("admin_profile.updated");
    await expect(panel).toContainText("Succeeded");
    await expect(panel.getByRole("button", { name: /network/i })).toHaveCount(0);
    await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toHaveCount(0);
    const before = await fixture("activity_state", { name: "activityreader" });
    expect(before.workCount).toBe(1); expect(before.entries).toBe(1); expect(before.access).toBe(1);
    const collected = await fixture("activity_collect"); expect(collected.read).toBeGreaterThan(0);
    const repeated = await fixture("activity_collect"); expect(repeated.stored).toBe(0);
    const after = await fixture("activity_state", { name: "activityreader" });
    expect(after.workCount).toBe(before.workCount);
    await page.goto(base + "/admin/settings/profile", {waitUntil:"networkidle"});
    await expect(page.getByTestId("admin-activity-summary")).toContainText(/Observed recently/i);
  });
  test("bounded pagination, permission-scoped network details and real responsive themes", async ({ page, context, browserName }) => {
    await login(context, "never");
    const audit=collectPageErrors(page,browserName,base);
    await page.goto(base + "/admin/audit?view=activity&action=fixture.work", {waitUntil:"networkidle"});
    const panel = page.getByTestId("admin-activity-panel");
    await expect(panel).toContainText("of 126 recorded events");
    await expect(panel).toContainText("Page 1 of 6");
    await expect(page.getByText("198.51.100.20", { exact: false })).toHaveCount(0);
    await panel.getByRole("link", { name: "Next", exact: true }).click();
    await expect(panel).toContainText("Page 2 of 6");
    expect(new URL(page.url()).searchParams.get("action")).toBe("fixture.work");
    await panel.getByRole("link", { name: "Network", exact:true }).first().click();
    await expect(panel).toContainText("Vercel-observed edge: 198.51.100.20");
    const csv = await context.request.get(base + "/admin/audit/export?view=activity&action=fixture.work");
    expect(csv.status()).toBe(200); expect(await csv.text()).not.toContain("198.51.100.20");
    for (const width of [375, 768, 1280]) for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 950 });
      await page.addInitScript(value => localStorage.setItem("jnuits-theme", value), theme);
      await page.goto(base + "/admin/audit?view=activity&action=fixture.work", {waitUntil:"networkidle"});
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { name: "Admin activity", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
      if (width === 375) {
        const details = panel.locator("article details").first(); await details.locator("summary").focus(); await page.keyboard.press("Enter"); await expect(details).toHaveAttribute("open", "");
      }
      if (process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS) await page.screenshot({ path: join(process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS, `activity-${browserName}-${width}-${theme}.png`), fullPage: true });
    }
    expect(audit.unexpectedErrors).toEqual([]);
    if(audit.departingPrefetchCancellations.length)console.log(`Observed ${audit.departingPrefetchCancellations.length} departing-document WebKit UI prefetch cancellations; API/export errors remain fatal.`);
  });
  test("an existing session records a new UTC day during client navigation",async({page,context})=>{
    await login(context,"activityreader");
    await page.goto(base+"/admin/audit?view=activity",{waitUntil:"networkidle"});
    await expect(page.getByTestId("admin-activity-panel")).toBeVisible();
    expect((await fixture("activity_state",{name:"activityreader"})).access).toBe(1);
    await fixture("activity_previous_day",{name:"activityreader"});
    await page.evaluate(()=>{(window as unknown as {fixtureDocument:string}).fixtureDocument="same-document";});
    await page.getByRole("link",{name:"Dashboard",exact:true}).click();
    await expect(page).toHaveURL(base+"/admin");
    await expect(page.getByTestId("admin-activity-summary")).toBeVisible();
    expect(await page.evaluate(()=>(window as unknown as {fixtureDocument:string}).fixtureDocument)).toBe("same-document");
    const state=await fixture("activity_state",{name:"activityreader"});
    expect(state.access).toBe(2);expect(state.entries).toBe(1);
  });
  test("content-only accounts cannot read cross-admin audit but retain their own summary", async ({ page, context }) => {
    const account=await login(context, "completionadmin");
    await page.goto(base + "/admin/settings/profile", {waitUntil:"networkidle"});
    await expect(page.getByTestId("admin-activity-summary")).toBeVisible();
    await page.goto(base + "/admin/audit?view=activity");
    await expect(page).not.toHaveURL(/\/admin\/audit/);
    await expect(page.getByTestId("admin-activity-panel")).toHaveCount(0);
    const response = await context.request.get(base + "/admin/audit/export?view=activity");
    expect(await response.text()).not.toContain("fixture.work");
    const before=await fixture("activity_password_state",{name:"completionadmin"});
    await page.goto(base+"/portal/profile/change-password", {waitUntil:"networkidle"});
    const newPassword=account.password+"-A7!";
    await page.getByLabel("Current password",{exact:true}).fill(account.password);
    await page.getByLabel("New password",{exact:true}).fill(newPassword);
    await page.getByLabel("Confirm new password",{exact:true}).fill(newPassword);
    const changed=page.waitForResponse(r=>r.url().endsWith("/api/profile/change-password")&&r.request().method()==="POST");
    await page.getByRole("button",{name:"Update password",exact:true}).click();
    await page.getByRole("button",{name:"Confirm password change",exact:true}).click();
    expect((await changed).status()).toBe(200);
    await fixture("activity_password_state",{name:"completionadmin",password:newPassword});
    await fixture("activity_collect");
    const after=await fixture("activity_password_state",{name:"completionadmin"});
    const newIds=after.providerPasswordIds.filter((id:string)=>!before.providerPasswordIds.includes(id));
    expect(newIds).toHaveLength(1);
    expect(after.projectedPasswordIds).toEqual(expect.arrayContaining(newIds));
  });
});
