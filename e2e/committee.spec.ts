import { expect, test } from "@playwright/test";
import axe from "axe-core";
test.beforeEach(async({context, baseURL})=>{
  await context.route("**/*", async route=>{
    const request=route.request();
    if(!["GET","HEAD","OPTIONS"].includes(request.method()) && new URL(request.url()).origin === new URL(baseURL!).origin && new URL(request.url()).pathname!=="/monitoring") { await route.abort(); throw new Error("Committee smoke must remain read-only"); }
    await route.continue();
  });
});
test("committee keyboard tabs, advisor history and member dialog remain reachable",async({page})=>{
  await page.goto("/committee");
  await expect(page.getByRole("heading",{level:1})).toContainText(/Executive.*Committee & Advisors/i);
  await expect(page.getByRole("main")).toHaveCount(1);
  const tabs=page.getByRole("tablist",{name:"Committee terms"});
  const first=tabs.getByRole("tab").first();
  await first.focus(); await page.keyboard.press("End");
  const last=tabs.getByRole("tab").last();
  await expect(last).toBeFocused(); await expect(last).toHaveAttribute("aria-selected","true");
  await page.keyboard.press("Home"); await expect(first).toHaveAttribute("aria-selected","true");
  await page.getByRole("button",{name:"Advisor History",exact:true}).click();
  await expect(page.locator("#former-advisors")).toBeVisible();
  const card=page.locator('[role="button"][aria-haspopup="dialog"]').first();
  await card.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card).toBeFocused();
});
// Each viewport retains the standard 30-second limit. Grouping three full
// page loads and Axe audits made populated production data exceed one budget.
for(const theme of ["light","dark"] as const){
  for(const width of [360,768,1280]){
    test("committee quote rendering and responsive layout in "+theme+" at "+width,async({page}, info)=>{
      await page.addInitScript(value=>localStorage.setItem("jnuits-theme",value),theme);
      await page.setViewportSize({width,height:900}); await page.goto("/committee");
      await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
      if (process.env.JNUITS_COMMITTEE_BROWSER_FIXTURES === "1") {
        await expect(page.locator("#current-committee blockquote").first()).toBeVisible();
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
      });
      await page.evaluate(axe.source);
      const violations = await page.evaluate(async () => {
        const engine = (window as unknown as { axe: typeof axe }).axe;
        return (await engine.run(document.querySelector("main")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations;
      });
      expect(violations).toEqual([]);
      await info.attach("committee-" + theme + "-" + width, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    });
  }
}
