import {test,expect,type BrowserContext} from "@playwright/test";
const base=process.env.PROFILE_COMPLETION_QA_BASE_URL || "https://127.0.0.1:3130";
const enabled=process.env.PROFILE_SELF_SERVICE_QA==="DISPOSABLE_SCRATCH";
test.use({trace:"off",screenshot:"off",actionTimeout:15000,ignoreHTTPSErrors:true});
async function fixture(name:string){const response=await fetch(`${process.env.ADMIN_VERIFICATION_QA_BRIDGE}/account`,{method:"POST",headers:{Authorization:`Bearer ${process.env.ADMIN_VERIFICATION_QA_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({name})});expect(response.ok).toBe(true);return response.json();}
async function login(context:BrowserContext,name:string){const account=await fixture(name);await context.addCookies(account.cookies.map((cookie:{name:string;value:string})=>({...cookie,domain:"127.0.0.1",path:"/",sameSite:"Lax"})));return account;}
test.describe("real owned completion and workplace declaration",()=>{
 test.skip(!enabled,"Only the production-mode disposable fixture runner is permitted.");
 test.describe.configure({mode:"serial",retries:0});test.setTimeout(120000);
 test("current and alumni cards use canonical data with no locked-value leaks",async({browser})=>{
  for(const [name,percent,count] of [["completionmember","89","8 of 9"],["completionalumni","88","7 of 8"]] as const){
   const context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
   try {
    const reset=await fetch(`${process.env.ADMIN_VERIFICATION_QA_BRIDGE}/completion_reset`,{method:"POST",headers:{Authorization:`Bearer ${process.env.ADMIN_VERIFICATION_QA_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({name})});expect(reset.ok).toBe(true);
    const account=await login(context,name);
    for(const width of [375,768,1280])for(const theme of ["light","dark"]){
     await page.setViewportSize({width,height:900});await page.addInitScript(value=>localStorage.setItem("jnuits-theme",value),theme);
     await page.goto(`${base}/portal`,{waitUntil:"networkidle"});
     await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
     const card=page.getByTestId("profile-completion-card");
     await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow",percent);
     await expect(card).toContainText(count);
     await expect(card).not.toContainText("Synthetic Workplace");
     expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    }
    await page.goto(`${base}/portal/profile/edit#dpe-workplaceApplicability`,{waitUntil:"networkidle"});
    await expect(page.getByLabel("Workplace applicability")).toHaveCount(0);
    await expect(page.locator("#direct-profile-edit-form")).toHaveCount(0);
    await page.getByLabel("Current password",{exact:true}).fill(account.password);
    const unlocked=page.waitForResponse(r=>r.url().endsWith("/api/profile/step-up")&&r.request().method()==="POST");
    await page.getByRole("button",{name:"Verify and unlock",exact:true}).click();
    expect((await unlocked).status()).toBe(200);
    expect((await context.cookies()).some(cookie=>cookie.name==="jnuits-step-up"&&cookie.secure&&cookie.httpOnly)).toBe(true);
    await expect(page.getByLabel("Workplace applicability")).toBeVisible();
    await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toHaveCount(0);
    await page.getByLabel("Workplace applicability").selectOption("not_applicable");
    await page.getByRole("button",{name:"Save direct changes"}).click();
    await expect(page.locator(".profile-edit-card--direct").getByRole("alert")).toContainText(/clear current organization/i);
    await expect(page.getByLabel("Current organization",{exact:true})).toHaveValue("Synthetic Workplace");
    await page.getByRole("button",{name:"Clear workplace fields locally"}).click();
    const saved=page.waitForResponse(r=>r.url().endsWith("/api/profile/direct")&&r.request().method()==="POST");
    await page.getByRole("button",{name:"Save direct changes"}).click();expect((await saved).status()).toBe(200);
    await expect(page.getByText("Profile changes saved. No admin approval is needed for these details.")).toBeVisible();
    await page.getByRole("link",{name:"Overview",exact:true}).click();
    await expect(page).toHaveURL(`${base}/portal`);
    await expect(page.getByTestId("profile-completion-card")).toContainText(name==="completionmember"?"7 of 8":"6 of 7");
    expect(errors).toEqual([]);
   }finally{await context.close();}
  }
 });
 test("linked admins receive separate owned completion on both self-service hosts",async({page,context})=>{
  await login(context,"completionadmin");
  for(const path of ["/admin","/admin/settings/profile"]){
   await page.goto(base+path,{waitUntil:"networkidle"});
   const admin=page.getByRole("region",{name:"Admin profile completeness",exact:true});
   const member=page.getByRole("region",{name:"Linked member profile completeness",exact:true});
   await expect(admin).toContainText("of 3");
   await expect(member).toContainText("of 9");
   await expect(member).not.toContainText("Synthetic Linked Admin");
   expect(await admin.getAttribute("aria-labelledby")).not.toBe(await member.getAttribute("aria-labelledby"));
  }
 });
 test("admin completion is separate and native session guidance does not promise roles",async({page,context})=>{
  await login(context,"never");await page.goto(`${base}/admin`,{waitUntil:"networkidle"});
  const card=page.getByTestId("profile-completion-card");await expect(card).toContainText("Admin profile completeness");await expect(card).toContainText("2 of 3");
  const response=await page.request.get(`${base}/api/admin/mfa-suggestion`);expect(response.status()).toBe(200);
  const body=await response.json();expect(body.value.guidance.state).toBe("setup");
  const role=body.value.guidance.capabilities.find((item:{operation:string})=>item.operation==="admin.role.change");
  expect(role.requirements).toEqual(["Existing role permission","Native AAL2 session","Current password","Exact session/intent-bound proof"]);
 });
});
