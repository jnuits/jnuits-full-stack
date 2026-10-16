import {expect,test,type BrowserContext} from "@playwright/test";
import {join} from "node:path";
import {collectPageErrors} from "./helpers/page-errors";

const enabled=process.env.ADMIN_AUDIT_QA==="DISPOSABLE_SCRATCH";
const base=process.env.PROFILE_COMPLETION_QA_BASE_URL||"https://127.0.0.1:3130";
test.use({trace:"off",screenshot:"off",ignoreHTTPSErrors:true,actionTimeout:15000});
async function fixture(action:string,input:Record<string,unknown>={}) {
  const response=await fetch(`${process.env.ADMIN_VERIFICATION_QA_BRIDGE}/${action}`,{method:"POST",headers:{Authorization:`Bearer ${process.env.ADMIN_VERIFICATION_QA_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify(input)});
  expect(response.ok,`Disposable ${action} failed`).toBe(true);return response.json();
}
async function login(context:BrowserContext,name="activityreader") {
  const account=await fixture("account",{name});
  await context.addCookies(account.cookies.map((cookie:{name:string;value:string})=>({...cookie,domain:"127.0.0.1",path:"/",sameSite:"Lax"})));
  return account;
}
async function job() {
  const result=await fixture("notice_job");expect(result.responses).toHaveLength(1);
  expect(result.responses[0].status).toBe(200);expect(result.responses[0].value.errors).toEqual([]);
  return result.responses[0].value;
}
test.describe("owned security notices and optional mail on disposable native Auth",()=>{
  test.skip(!enabled,"Only the isolated production-mode runner is authorized.");
  test.describe.configure({mode:"serial",retries:0});test.setTimeout(120000);
  test.beforeEach(async()=>{await fixture("notice_reset");});

  test("owned inbox paging, keyboard, themes and read state preserve permission boundaries",async({page,context,browserName})=>{
    await fixture("notice_seed",{count:36});await login(context);
    const audit=collectPageErrors(page,browserName,base);
    await page.goto(base+"/admin/notifications",{waitUntil:"networkidle"});
    const panel=page.getByTestId("admin-security-notices-panel");
    await expect(panel).toContainText("36 unread notifications");
    await expect(panel.locator("article")).toHaveCount(25);
    await panel.getByRole("button",{name:"Next",exact:true}).click();
    await expect(panel.locator("article")).toHaveCount(11);
    await expect(page).toHaveURL(/page=2/);
    const state=await fixture("notice_state");
    const foreign=await fixture("notice_state",{name:"never"});
    expect(state.noticeIds).toHaveLength(36);expect(foreign.noticeIds).toHaveLength(36);
    const denied=await context.request.post(base+"/api/admin/notifications",{headers:{Origin:base},data:{action:"mark_read",noticeId:foreign.noticeIds[0]}});
    expect(denied.status()).toBe(503);expect((await fixture("notice_state",{name:"never"})).unread).toBe(36);
    await panel.getByRole("button",{name:/Mark notice as read:/}).first().click();
    await expect(panel).toContainText("35 unread notifications");
    await panel.getByRole("button",{name:"Mark all as read",exact:true}).click();
    await expect(panel).toContainText("0 unread notifications");
    for(const width of [375,768,1280])for(const theme of ["light","dark"]) {
      await page.setViewportSize({width,height:950});
      await page.addInitScript(value=>localStorage.setItem("jnuits-theme",value),theme);
      await page.goto(base+"/admin/notifications",{waitUntil:"networkidle"});
      await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
      await expect(panel).toBeVisible();await expect(page.locator("main:visible")).toHaveCount(1);
      await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
      const next=panel.getByRole("button",{name:"Next",exact:true});await next.focus();await expect(next).toBeFocused();
      if(process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS)await page.screenshot({path:join(process.env.ADMIN_VERIFICATION_QA_SCREENSHOTS,`notices-${browserName}-${width}-${theme}.png`),fullPage:true});
    }
    expect(audit.unexpectedErrors).toEqual([]);
    await login(context,"completionadmin");await page.goto(base+"/admin/notifications");
    await expect(page.getByTestId("admin-security-notices-panel")).toHaveCount(0);
    const read=await context.request.get(base+"/api/admin/notifications");expect(read.status()).toBe(503);
  });

  test("actual native password change creates one peer notice, failed change and replay create none",async()=>{
    const native=await fixture("notice_native_password");expect(native.failedChangeCreatedEvent).toBe(false);expect(native.passwordId).toBeTruthy();
    const first=await job();expect(first.imported).toBeGreaterThan(0);expect(first.notices).toBeGreaterThan(0);
    const before=await fixture("notice_state");expect(before.noticeIds.length).toBeGreaterThan(0);expect(before.accepted).toBe(0);
    expect((await job()).notices).toBe(0);expect((await fixture("notice_state")).noticeIds).toEqual(before.noticeIds);
  });

  test("native MFA setup, failed code, first verification and routine verification are distinguished",async()=>{
    const before=await fixture("notice_state");
    const native=await fixture("notice_native_mfa");expect(native.failedVerificationCreatedEvent).toBe(false);
    expect(native.verificationIds).toHaveLength(2);expect(native.removalIds).toHaveLength(1);
    await job();const after=await fixture("notice_state");
    expect(after.nativeEnrollIds.filter((id:string)=>!before.nativeEnrollIds.includes(id))).toEqual([native.verificationIds[0]]);
    expect(after.nativeRemovalIds.filter((id:string)=>!before.nativeRemovalIds.includes(id))).toEqual(native.removalIds);
    expect((await job()).notices).toBe(0);expect(after.accepted).toBe(0);
  });

  test("a verified invitation creates an immediate panel notice without waiting for collection",async({page,context,browserName})=>{
    await fixture("notice_prepare_invitation");
    const account=await login(context,"super");
    const memberId=browserName==="chromium"?"JnUITS-2099957":browserName==="webkit"?"JnUITS-2099956":"JnUITS-2099961";
    await page.goto(base+"/admin/admin-profiles?tab=invitations&inviteMemberQ="+memberId,{waitUntil:"networkidle"});
    const form=page.locator("form").filter({has:page.locator('input[name="inviteMode"][value="member"]')});
    const radio=form.getByRole("radio").first();await expect(radio).toBeVisible();
    const bounds=await radio.boundingBox();expect(bounds?.width).toBeGreaterThanOrEqual(12);expect(bounds?.height).toBeGreaterThanOrEqual(12);
    await radio.check();await form.locator('select[name="roleCode"]').selectOption("content_admin");
    await form.getByRole("button",{name:"Invite selected member",exact:true}).click();
    const dialog=page.getByRole("dialog",{name:"Verify your account"});
    await dialog.getByLabel("Current password",{exact:true}).fill(account.password);
    await dialog.getByRole("button",{name:"Verify password and continue",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Admin invitation sent",exact:true})).toBeVisible();
    await page.goto(base+"/admin/notifications",{waitUntil:"networkidle"});
    await expect(page.getByRole("heading",{name:"Admin invitation created",exact:true})).toBeVisible();
    await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toHaveCount(0);
  });

  test("optional preferences and signed delivery webhooks distinguish acceptance from delivery",async({page,context})=>{
    await login(context);await page.goto(base+"/admin/settings/profile",{waitUntil:"networkidle"});
    const preferences=page.getByTestId("admin-notification-preferences-form");
    const checkbox=preferences.locator('input[name="admin_security_email_opt_in"]');await expect(checkbox).not.toBeChecked();
    await checkbox.check();await preferences.getByRole("button",{name:"Save notification preferences",exact:true}).click();
    await expect(preferences.getByRole("status")).toContainText("Email preferences saved");
    await fixture("notice_enable");await fixture("notice_seed",{count:1});expect((await job()).sends).toBe(1);
    let state=await fixture("notice_state");expect(state.deliveryStates).toEqual(["accepted"]);expect(state.accepted).toBe(1);
    await page.goto(base+"/admin/notifications",{waitUntil:"networkidle"});await expect(page.getByText("Accepted by mail provider",{exact:true})).toBeVisible();
    const webhook=await fixture("notice_webhook",{type:"email.delivered",repeat:true});expect(webhook.responses.map((r:{status:number})=>r.status)).toEqual([200,200]);
    await page.reload({waitUntil:"networkidle"});await expect(page.getByText("Delivered",{exact:true})).toBeVisible();
    await fixture("notice_webhook",{type:"email.complained",repeat:true});
    await fixture("notice_seed",{count:1});await job();state=await fixture("notice_state");
    expect(state.accepted).toBe(1);expect(state.deliveryStates).toContain("suppressed");
  });

  test("lost acceptance retries the frozen provider key once and overlapping jobs do not duplicate",async()=>{
    await fixture("notice_enable",{fault:"accepted_lost"});await fixture("notice_seed",{count:1});await job();
    const uncertain=await fixture("notice_state");expect(uncertain.deliveryStates).toEqual(["uncertain"]);expect(uncertain.accepted).toBe(1);
    const parallel=await fixture("notice_job",{concurrent:true});expect(parallel.responses.map((r:{status:number})=>r.status).sort()).toEqual([200,503]);
    expect(parallel.responses.some((r:{value:{errors:string[]}})=>r.value.errors.includes("job_already_running"))).toBe(true);
    const after=await fixture("notice_state");expect(after.accepted).toBe(1);expect(after.requests).toBe(2);expect(after.deliveryStates).toEqual(["accepted"]);
    expect(after.providerMessageIds).toEqual(uncertain.providerMessageIds);
  });

  test("provider suppression and revoked audit access stop optional email",async()=>{
    await fixture("notice_enable",{suppressed:true});await fixture("notice_seed",{count:1});await job();
    const blocked=await fixture("notice_state");expect(blocked.accepted).toBe(0);expect(blocked.deliveryStates).toEqual(["suppressed"]);
    await fixture("notice_revoke");await fixture("notice_seed",{count:1});await job();
    expect((await fixture("notice_state")).accepted).toBe(0);
  });

  test("monthly recommendations are opt-in, personal and at most one current-month email",async()=>{
    await fixture("notice_enable",{recommendations:true});
    const first=await job();expect(first.digests).toBe(1);expect(first.sends).toBe(1);
    const state=await fixture("notice_state");expect(state.accepted).toBe(1);expect(state.subjects[0]).toMatch(/recommendations/i);
    const repeat=await job();expect(repeat.sends).toBe(0);expect((await fixture("notice_state")).accepted).toBe(1);
  });
});
