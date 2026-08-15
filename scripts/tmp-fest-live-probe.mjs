import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});

await page.goto("https://jnuits.org.bd/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3_000);
const campaign = page.getByRole("region", { name: "JnU AI & IT Fest 2026" });
const images = await campaign.getByRole("img").evaluateAll((nodes) =>
  nodes.map((node) => ({
    alt: node.getAttribute("alt"),
    complete: node.complete,
    loading: node.getAttribute("loading"),
    naturalWidth: node.naturalWidth,
    src: node.currentSrc,
  }))
);

console.log(JSON.stringify({ consoleErrors, images }, null, 2));
await browser.close();
