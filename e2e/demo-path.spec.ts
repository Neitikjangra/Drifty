import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * The full demo path on a phone-sized screen, as a new agency would do it:
 * landing → sign up → onboarding with the demo project → summarise → approver settles the
 * conflict (as Priya, in her own browser) → confirm → v2 misses the CTA (drift check) →
 * back to creative → v3 → send → Priya approves → ledger + CSV.
 */

const stamp = Date.now().toString(36);
const email = `pw-${stamp}@drifty.test`;
const password = `Demo-${stamp}-pw!`;
const demoFile = (name: string) => path.join(process.cwd(), "public", "demo", name);
const V3_COPY = "Sunrise Cafe Diwali special: 20% off all mithai boxes. Order now.";

async function openInternal(page: Page) {
  await page.getByRole("tab", { name: "Internal" }).click();
}

test("new agency completes the demo project", async ({ page, browser }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.name));

  // Landing → sign up
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /doesn.t drift/i })).toBeVisible();
  await page.getByRole("link", { name: "Start free" }).first().click();
  await expect(page).toHaveURL(/\/login\?mode=signup/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Onboarding with the demo project (on by default)
  await expect(page).toHaveURL(/\/app\/onboarding/, { timeout: 30_000 });
  await page.getByLabel("Your name").fill("Playwright AM");
  await page.getByLabel("Agency or workspace name").fill(`PW Agency ${stamp} (test)`);
  await expect(page.getByLabel(/Add a demo project/)).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]{36}\?demo=1/, { timeout: 60_000 });
  await expect(page.getByText(/Demo guide · 0 of 6 done/)).toBeVisible();
  const projectUrl = page.url().split("?")[0];

  // 1. Summarise (real Gemini)
  await page.getByRole("button", { name: "Summarise feedback" }).click();
  await expect(page.getByText(/suggested from \d+ message/)).toBeVisible({ timeout: 90_000 });

  // 2. Priya (approver) opens her personal link in her own browser and settles the conflict
  const priyaHref = await page.getByRole("link", { name: /Open \(private window/ }).getAttribute("href");
  expect(priyaHref).toMatch(/\/join\//);
  const priyaCtx = await browser.newContext({ ...test.info().project.use });
  const priya = await priyaCtx.newPage();
  await priya.goto(priyaHref!);
  await expect(priya).toHaveURL(/\/room\//, { timeout: 30_000 });
  const conflictChoice = priya.getByRole("button", { name: "Choose A" });
  const hasConflict = await conflictChoice.waitFor({ timeout: 45_000 }).then(() => true, () => false);
  if (hasConflict) {
    await conflictChoice.click();
    await expect(priya.getByText(/chose:/)).toBeVisible();
  }

  // 3. Confirm the remaining suggestions in Internal
  await page.reload();
  await openInternal(page);
  // ChatUI renders only messages near the visible area: scroll up to the change list card.
  // Rows carry their status as a class; confirm whatever is still "suggested" (the CTA change).
  const card = page.locator("drifty-changelist, nc-c-drifty-changelist").first();
  const suggested = page.locator(".item.suggested");
  const chatTab = page.getByRole("tab", { name: "Internal" });
  for (let i = 0; i < 15 && (await card.count()) === 0; i++) {
    const box = await chatTab.boundingBox();
    if (box) await page.mouse.move(box.x + 40, box.y + 260);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(700);
  }
  await expect(card).toBeAttached({ timeout: 20_000 });
  await card.scrollIntoViewIfNeeded();
  for (let i = 0; i < 6 && (await suggested.count()) > 0; i++) {
    const before = await suggested.count();
    await suggested.first().getByRole("button", { name: "Confirm", exact: true }).click();
    await expect.poll(() => suggested.count(), { timeout: 15_000 }).toBeLessThan(before);
  }
  await expect(suggested, "every suggestion confirmed before v2").toHaveCount(0);

  // 4. v2 keeps "Buy now" → held for the drift check, CTA missing
  await page.getByRole("button", { name: "Upload v2" }).click();
  await page.getByLabel("Draft file").setInputFiles(demoFile("sunrise-v2.png"));
  await page.getByRole("button", { name: "Post v2" }).click();
  await expect(page.getByText("Held for check")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Drift check v2:/)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/missing/).first()).toBeVisible();

  // 5. Back to creative → v3 with "Order now" → send to client
  await page.getByRole("button", { name: "Back to creative" }).first().click();
  await expect(page.getByText(/Sent back to the creative/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Upload v3" }).click();
  await page.getByLabel("Draft file").setInputFiles(demoFile("sunrise-v3.png"));
  await page.getByLabel("Caption / copy").fill(V3_COPY);
  await page.getByRole("button", { name: "Post v3" }).click();
  await expect(page.getByText(/Drift check v3:/)).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: /Send (v3 to client|to client anyway)/ }).first().click();
  await expect(page.getByText("In review").first()).toBeVisible({ timeout: 30_000 });

  // 6. Priya approves v3 on her phone
  await priya.reload();
  await priya.getByRole("button", { name: "Approve v3" }).click({ timeout: 60_000 });
  await expect(priya.getByText(/Approved/).first()).toBeVisible({ timeout: 30_000 });

  // 7. Ledger + CSV
  await page.goto(`${projectUrl}/ledger`);
  await expect(page.getByRole("heading", { name: "Approval ledger" })).toBeVisible();
  await expect(page.getByText("Diwali post · v3")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Export CSV/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^drifty-ledger-.*\.csv$/);

  await page.goto(projectUrl);
  await expect(page.getByText(/Demo guide · 6 of 6 done/)).toBeAttached();
  expect(errors, "no uncaught page errors on the demo path").toEqual([]);
  await priyaCtx.close();
});
