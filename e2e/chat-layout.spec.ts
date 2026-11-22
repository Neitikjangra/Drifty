import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { expect, test, type Page } from "@playwright/test";

/**
 * Chat layout regression: the sender's own (right-side) bubble must sit fully inside the chat
 * column, with no ChatUI channel list and no delivery/read dots, on desktop and at 375 px.
 * Uses a fixed local test agency (e2e-layout@drifty.test) and its own project.
 */
dotenv.config({ path: ".env.local", quiet: true });
const strip = (v?: string) => (v ?? "").trim().replace(/^"(.*)"$/, "$1");
const admin = createClient(strip(process.env.NEXT_PUBLIC_SUPABASE_URL), strip(process.env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false } });
const EMAIL = "e2e-layout@drifty.test";

async function signIn(page: Page) {
  await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true }).catch(() => {});
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  await page.goto(`/auth/callback?token_hash=${data.properties!.hashed_token}&type=magiclink&next=/app`);
}

/** Measures inside ChatUI's shadow DOM. */
async function measure(page: Page, text: string) {
  return page.evaluate((needle) => {
    const provider = document.querySelector("nc-chat-ui-app-provider");
    const container = provider?.parentElement;
    if (!container) return null;
    const c = container.getBoundingClientRect();
    let leftList: Element | null = null;
    const hits: Element[] = [];
    let states = 0;
    const walk = (root: ParentNode) => {
      for (const el of root.querySelectorAll("*")) {
        const sr = (el as HTMLElement).shadowRoot;
        if (sr) walk(sr);
        const cls = (el as HTMLElement).className?.toString?.() ?? "";
        if (cls.includes("nc-chatui-app-wrapper-left")) leftList = el;
        if (/message-state|msg-state|read-receipt|receipt/i.test(cls) && (el as HTMLElement).offsetParent) states++;
        if (el.children.length === 0 && (el.textContent ?? "").includes(needle) && !(el as HTMLElement).closest?.("nc-latest-message")) hits.push(el);
      }
    };
    walk(document);
    let b: Element | null = hits[hits.length - 1] ?? null;
    while (b && !(b as HTMLElement).classList?.contains("nc-chatui-msg-bubble")) b = b.parentElement ?? ((b.getRootNode() as ShadowRoot).host ?? null);
    const r = b?.getBoundingClientRect();
    const listVisible = leftList ? getComputedStyle(leftList).display !== "none" && (leftList as HTMLElement).getBoundingClientRect().width > 0 : false;
    return { containerLeft: c.left, containerRight: c.right, bubbleLeft: r?.left ?? null, bubbleRight: r?.right ?? null, listVisible, states };
  }, text);
}

async function sendInChat(page: Page, text: string) {
  const box = page.locator("nc-chat-ui-app-provider textarea").first();
  await box.waitFor({ timeout: 45_000 });
  await box.fill(text);
  await box.press("Enter");
}

for (const size of [
  { name: "desktop", width: 1366, height: 860 },
  { name: "phone", width: 375, height: 812 },
]) {
  test(`own message bubble fits the chat (${size.name})`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await signIn(page);
    // Setup through the API with the same session (idempotent); the UI under test is the chat.
    await page.request.post("/api/onboarding", { data: { workspaceName: "E2E Layout (test)", displayName: "Layout AM" } });
    await admin.from("workspaces").update({ plan: "pilot" }).eq("name", "E2E Layout (test)");
    const { data: ws } = await admin.from("workspaces").select("id").eq("name", "E2E Layout (test)").limit(1).single();
    let { data: proj } = await admin.from("projects").select("id").eq("workspace_id", ws!.id).eq("client_name", "Layout room").maybeSingle();
    if (!proj) {
      const r = await page.request.post("/api/projects", { data: { clientName: "Layout room" } });
      proj = { id: (await r.json()).id };
    }
    await page.goto(`/app/projects/${proj!.id}`);
    const text = `Layout check ${size.name} ${Date.now().toString(36)}: a long sentence that must wrap inside the bubble without being cut off at the right edge`;
    await sendInChat(page, text);
    await expect.poll(async () => (await measure(page, text))?.bubbleRight ?? null, { timeout: 20_000 }).not.toBeNull();
    const m = (await measure(page, text))!;
    await page.screenshot({ path: `test-results/chat-layout-${size.name}.png` });
    expect(m.listVisible, "ChatUI's own channel list is hidden").toBe(false);
    expect(m.bubbleRight!, "bubble ends inside the chat column").toBeLessThanOrEqual(m.containerRight - 4);
    expect(m.bubbleLeft!, "bubble starts inside the chat column").toBeGreaterThanOrEqual(m.containerLeft);
    expect(m.states, "no delivery/read dots").toBe(0);

    // After a moment: names resolved (bot shows as "Drifty AI") and no message left "sending".
    await page.waitForTimeout(12_000);
    const after = await page.evaluate(() => {
      const texts: string[] = [];
      let spinners = 0;
      const walk = (root: ParentNode) => {
        for (const el of root.querySelectorAll("*")) {
          const sr = (el as HTMLElement).shadowRoot;
          if (sr) walk(sr);
          if (el.children.length === 0) texts.push((el.textContent ?? "").trim());
          const cls = (el as HTMLElement).className?.toString?.() ?? "";
          if (/loading|sending|spin/i.test(cls) && (el as HTMLElement).offsetParent) spinners++;
        }
      };
      walk(document.querySelector("nc-chat-ui-app-provider")!);
      return { rawBot: texts.includes("driftybot"), spinners };
    });
    await page.screenshot({ path: `test-results/chat-layout-${size.name}-later.png` });
    expect(after.rawBot, "bot never shown by its raw id").toBe(false);
    expect(after.spinners, "no message stuck sending").toBe(0);
  });
}
