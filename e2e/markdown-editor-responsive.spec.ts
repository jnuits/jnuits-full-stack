import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const stylesheet = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

test("the Markdown editor responds to its container instead of crushing the input", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 1280 });
  await page.setContent(`
    <style>${stylesheet}</style>
    <main style="width: 430px">
      <div class="markdown-editor">
        <div class="markdown-editor__grid">
          <label class="markdown-editor__input">
            <textarea>Readable member story body</textarea>
          </label>
          <div class="markdown-editor__preview">Preview</div>
        </div>
      </div>
    </main>
  `);

  const narrowInput = await page.locator(".markdown-editor__input").boundingBox();
  const narrowPreview = await page.locator(".markdown-editor__preview").boundingBox();

  expect(narrowInput).not.toBeNull();
  expect(narrowPreview).not.toBeNull();
  expect(narrowInput?.width ?? 0).toBeGreaterThanOrEqual(300);
  expect(narrowPreview?.y ?? 0).toBeGreaterThan(narrowInput?.y ?? 0);

  await page.locator("main").evaluate((element) => {
    element.style.width = "820px";
  });

  const wideInput = await page.locator(".markdown-editor__input").boundingBox();
  const widePreview = await page.locator(".markdown-editor__preview").boundingBox();

  expect(wideInput).not.toBeNull();
  expect(widePreview).not.toBeNull();
  expect(wideInput?.width ?? 0).toBeGreaterThanOrEqual(300);
  expect(widePreview?.x ?? 0).toBeGreaterThan(wideInput?.x ?? 0);
});
