import { expect, test } from "@playwright/test";

test("dynamic HTML scripts share the response nonce and hydrate without CSP violations", async ({page})=>{
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.addInitScript(()=>{
    (window as unknown as {cspViolations:string[]}).cspViolations=[];
    document.addEventListener("securitypolicyviolation",event=>{
      (window as unknown as {cspViolations:string[]}).cspViolations.push(event.effectiveDirective+":"+event.blockedURI);
    });
  });
  const response=await page.goto("/",{waitUntil:"domcontentloaded"});
  expect(response?.status()).toBe(200);
  const csp=response!.headers()["content-security-policy"];
  const nonce=csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  const scripts=csp.split(";").find(value=>value.trim().startsWith("script-src"))!;
  expect(scripts).toContain("'strict-dynamic'");expect(scripts).not.toMatch(/unsafe-inline|unsafe-eval/);
  expect(response!.headers()["cache-control"]).toContain("no-store");
  await expect(page.locator("main#main-content")).toHaveCount(1);
  const allNonces=await page.locator("script").evaluateAll(nodes=>nodes.filter(node=>!(node as HTMLScriptElement).src || (node as HTMLScriptElement).src.includes("/_next/")).map(node=>(node as HTMLScriptElement).nonce));
  expect(allNonces.length).toBeGreaterThan(0);expect(allNonces.every(value=>value===nonce)).toBe(true);
  await page.locator('.public-skip-link').focus();await page.keyboard.press("Enter");await expect(page.locator("#main-content")).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toMatch(/light|dark/);
  const initialTheme=await page.evaluate(()=>document.documentElement.dataset.theme);
  await page.getByRole("button",{name:"Toggle color theme",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).not.toBe(initialTheme);
  await page.evaluate(()=>{(window as unknown as {nonceNavigationMarker:string}).nonceNavigationMarker="hydrated";});
  const menuButton=page.getByRole("button",{name:"Open navigation menu",exact:true});
  const mobileMenu=await menuButton.isVisible();
  if(mobileMenu)await menuButton.click();
  const navigation=page.getByRole("navigation",{name:mobileMenu?"Mobile navigation":"Primary navigation",exact:true});
  await navigation.locator('a[href="/about"]').click();await expect(page).toHaveURL(/\/about/,{timeout:20000});
  expect(await page.evaluate(()=>(window as unknown as {cspViolations:string[]}).cspViolations)).toEqual([]);
  expect(await page.evaluate(()=>(window as unknown as {nonceNavigationMarker?:string}).nonceNavigationMarker)).toBe("hydrated");
  expect(errors).toEqual([]);
});

test("separate documents never reuse a nonce",async({request})=>{
  const one=await request.get("/",{headers:{accept:"text/html","x-nonce":"injected"}});
  const two=await request.get("/",{headers:{accept:"text/html","x-nonce":"injected"}});
  const first=one.headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
  const second=two.headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
  expect(first).toBeTruthy();expect(first).not.toBe("injected");expect(first).not.toBe(second);
});

test("unnonced parser-inserted scripts are blocked by the production policy",async({page})=>{
  test.setTimeout(60000);
  await page.route("**/",async route=>{
    const response=await route.fetch();
    const nonce=response.headers()["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    const body=await response.text();
    expect(body).toContain("</body>");
    // The permitted parser-inserted control must run after the blocked candidate.
    // This proves non-execution without relying on WebKit's violation-event timing.
    await route.fulfill({response,body:body.replace("</body>",`<script>window.untrustedScriptRan=true</script><script nonce="${nonce}">window.allowedControlScriptRan=true</script></body>`)});
  });
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {allowedControlScriptRan?:boolean}).allowedControlScriptRan)).toBe(true);
  expect(await page.evaluate(()=>(window as unknown as {untrustedScriptRan?:boolean}).untrustedScriptRan)).toBeUndefined();
});
