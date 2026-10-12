import { expect, test } from "@playwright/test";

test.describe("committee page interactive behaviors", () => {
  test("renders hero, term switcher, advisors, and handles interactions", async ({
    page,
  }) => {
    await page.goto("/committee", { waitUntil: "domcontentloaded" });

    // Verify main landmarks
    await expect(page.locator("h1")).toContainText(
      /Executive.*Committee & Advisors/i
    );

    // Verify hero action buttons exist
    const currentBtn = page.getByRole("button", { name: "Current Committee" });
    const advisorBtn = page.getByRole("button", { name: "Advisor Board" });
    const historyBtn = page.getByRole("button", {
      name: "Advisor History",
      exact: true,
    });
    await expect(currentBtn).toBeVisible();
    await expect(advisorBtn).toBeVisible();
    await expect(historyBtn).toBeVisible();

    // Verify Advisor History expands disclosure
    await historyBtn.click();
    const formerSection = page.locator("#former-advisors");
    await expect(formerSection).toBeVisible();

    // Verify term switching
    const termButtons = page.locator("#current-committee button, .committee-page button").filter({
      hasText: /^\d+(st|nd|rd|th)/,
    });
    const termCount = await termButtons.count();
    expect(termCount).toBeGreaterThan(0);

    // If 5th term button exists, click it and ensure active state updates
    const fifthPill = termButtons.filter({ hasText: /^5th/ });
    if ((await fifthPill.count()) > 0) {
      await fifthPill.first().click();
      await expect(fifthPill.first()).toHaveAttribute("aria-pressed", "true");
    }

    // Switch back to 7th term
    const seventhPill = termButtons.filter({ hasText: /^7th/ });
    if ((await seventhPill.count()) > 0) {
      await seventhPill.first().click();
      await expect(seventhPill.first()).toHaveAttribute("aria-pressed", "true");

      // Verify member cards exist in 7th term
      const memberCards = page.locator("article[role='button']");
      const cardCount = await memberCards.count();
      if (cardCount > 0) {
        const firstCard = memberCards.first();
        await firstCard.click();
        const dialog = page.locator("div[role='dialog']");
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
      }
    }
  });
});
