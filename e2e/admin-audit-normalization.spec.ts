import {expect,test,type BrowserContext} from "@playwright/test";
const enabled=process.env.ADMIN_AUDIT_QA === "DISPOSABLE_SCRATCH";
const base="http://127.0.0.1:3127";
test.use({trace:"off",screenshot:"off",actionTimeout:15000});
async function fixture(action:string,input:Record<string,unknown>={}) {
 const response=await fetch(`${process.env.ADMIN_VERIFICATION_QA_BRIDGE}/${action}`,{method:"POST",headers:{Authorization:`Bearer ${process.env.ADMIN_VERIFICATION_QA_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify(input)});
 expect(response.ok).toBe(true);return response.json();
}
async function signIn(context:BrowserContext,name:string) {
 const account=await fixture("account",{name});
 await context.addCookies(account.cookies.map((cookie:{name:string;value:string})=>({...cookie,domain:"127.0.0.1",path:"/",sameSite:"Lax"})));
}
test.describe("production-mode disposable admin repairs",()=>{
 test.skip(!enabled,"Only the isolated local Supabase runner is authorized.");
 test.describe.configure({mode:"serial",retries:0});test.setTimeout(120000);
 test.beforeEach(async({page})=>{await fixture("audit_reset"); await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*",r=>r.abort());});
 test("self-profile isolation and permission-aware content discovery",async({page,context})=>{
  await signIn(context,"audit");await page.goto(`${base}/admin/settings/profile`);
  await expect(page.getByRole("heading",{name:"My admin profile"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Admin Accounts",exact:true})).toHaveCount(0);
  await page.getByLabel("Display name",{exact:true}).fill("Synthetic audit edited");
  await page.getByRole("button",{name:"Save admin profile",exact:true}).click();
  await expect(page).toHaveURL(`${base}/admin/settings/profile`);
  await expect(page.getByRole("heading",{name:"Admin profile updated"})).toBeVisible();
  await expect(page.getByLabel("Display name",{exact:true})).toHaveValue("Synthetic audit edited");
  await page.goto(`${base}/admin/admin-profiles?tab=self&profile=forged`);
  await expect(page.getByRole("heading",{name:"My admin profile"})).toBeVisible();
  await page.goto(`${base}/admin/admin-profiles`);await expect(page).not.toHaveURL(/admin-profiles/);
  await page.goto(`${base}/admin/content`);await expect(page.locator(".admin-hub-tile").filter({hasText:"Projects"})).toBeVisible();
  await expect(page.getByRole("link",{name:/Contact Settings/})).toHaveCount(0);
  await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toHaveCount(0);
 });
 test("real singleton preservation, conflict rejection and supported project save",async({page,context})=>{
  await signIn(context,"never");await page.goto(`${base}/admin/content/pages?edit=home`);
  await page.getByLabel("Title",{exact:true}).fill("Synthetic home edited");await page.getByRole("button",{name:/Save content page/}).click();
  await expect(page.getByRole("heading",{name:"Content page saved"})).toBeVisible();
  const state=await fixture("audit_state");expect(state.home.stats).toEqual([{value:"preserve"}]);expect(state.home.sliderImages).toEqual(["preserve"]);expect(state.home.heroSlides[1].title).toBe("Second");expect(state.home.aboutSection.future).toBe(true);
  await page.getByLabel("Title",{exact:true}).fill("Stale synthetic edit");await fixture("audit_conflict");await page.getByRole("button",{name:/Save content page/}).click();
  await expect(page.getByRole("heading",{name:"Content page not saved"})).toBeVisible();await expect(page.getByLabel("Title",{exact:true})).toHaveValue("Concurrent synthetic edit");
  await page.getByRole("combobox",{name:/^Page/}).selectOption("footer");await expect(page).toHaveURL(/edit=footer/);await expect(page.getByRole("combobox",{name:/^Page/})).toHaveValue("footer");
  await page.goto(`${base}/admin/content/projects?editProject=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1`);
  const form=page.getByRole("button",{name:"Update project"}).locator("xpath=ancestor::form");
  await expect(form.getByLabel("Tagline",{exact:true})).toHaveValue("Preserved tagline");await form.locator('input[name="title"]').fill("Synthetic project edited");await form.getByRole("button",{name:"Update project"}).click();
  await expect(page.getByRole("heading",{name:"Project updated"})).toBeVisible();
  const after=await fixture("audit_state");expect(after.project).toMatchObject({title:"Synthetic project edited",tagline:"Preserved tagline",cover:"https://example.com/fixture-cover.jpg",featured:true,status:"active"});
 });
 test("advisor intent, nested confirmation, bounded actor filters and advanced media at real breakpoints",async({page,context})=>{
  await signIn(context,"never");await page.goto(`${base}/admin/committee`);
  await page.getByRole("button",{name:"Open actions for Synthetic Audit Advisor"}).click();await page.getByRole("menuitem",{name:"Invite/link portal user"}).click();
  await expect(page.getByRole("tab",{name:"access",exact:true})).toHaveAttribute("aria-selected","true");
  await page.getByRole("button",{name:"Link auth user",exact:true}).click();
  const confirmation=page.getByRole("dialog",{name:"Link advisor portal account?"});await expect(confirmation).toBeVisible();await page.keyboard.press("Escape");await expect(confirmation).toHaveCount(0);await expect(page.getByRole("tab",{name:"access",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Close panel",exact:true}).click();
  await page.goto(`${base}/admin/audit?actor=22222222-2222-4222-8222-222222222222&q=fixture`);await expect(page.getByRole("combobox",{name:"Actor user ID",exact:true})).toHaveValue("22222222-2222-4222-8222-222222222222");
  expect(await page.getByRole("link",{name:/Export/}).getAttribute("href")).toContain("actor=22222222");
  await expect(page.locator('#audit-actors option[label="Synthetic audit edited"]')).toHaveCount(1);
  for(const width of [375,768,1280]) for(const theme of ["light","dark"]) {
   await page.setViewportSize({width,height:950});await page.goto(`${base}/admin/content/media?theme=${theme}`);await page.evaluate(t=>{document.documentElement.dataset.theme=t;document.documentElement.classList.toggle("dark",t==="dark");},theme);
   const disclosure=page.locator("details").filter({has:page.locator("summary",{hasText:"Advanced: register"})});await expect(disclosure).not.toHaveAttribute("open","");
   await disclosure.locator("summary").focus();await page.keyboard.press("Enter");await expect(disclosure.getByRole("button",{name:"Save media asset"})).toBeVisible();
   expect(await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
 });
});
