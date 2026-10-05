import {expect,test} from "@playwright/test";
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.JNUITS_CONTENT_BROWSER_FIXTURES!=="1",
  "Forty disposable archive rows require the managed reserved-endpoint fixture server.");
test("older blog posts remain reachable and category navigation resets pagination",async({page})=>{
  await page.goto("/blogs",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Fixture Blog 40",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Next",exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("heading",{name:"Fixture Blog 16",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Fixture Blog 40",exact:true})).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Fixture Blog 1",exact:true})).toBeVisible();
  await page.locator(".blog-category-nav").getByRole("link",{name:"Tech",exact:true}).click();
  await expect.poll(()=>new URL(page.url()).searchParams.get("category")?.toLowerCase()).toBe("tech");
  expect(new URL(page.url()).searchParams.get("page")).toBeNull();
  await expect(page.getByRole("heading",{name:"Fixture Blog 40",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Fixture Blog 39",exact:true})).toHaveCount(0);
  await page.locator(".blog-category-nav").getByRole("link",{name:"All",exact:true}).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole("heading",{name:"Fixture Blog 39",exact:true})).toBeVisible();
});
