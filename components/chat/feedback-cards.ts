"use client";
import { changeListCardSchema, conflictCardSchema, readItemMeta, type ChangeListCard, type ConflictCard } from "@/lib/feedback/cards";
import { getCardActions, liveMetadata, METADATA_EVENT, unwrap, type MetadataEventDetail, type SdkMessageLike } from "./deliverable-card-element";

/**
 * `drifty:changelist` (internal room, FR-8/FR-9) and `drifty:conflict` (client room, FR-12).
 * Buttons only call our API; the server writes status into message metadata and every
 * viewer's card updates live. Same "only rebuild when the view changes" rule as the
 * deliverable card, so ChatUI hover re-renders don't swallow clicks.
 */

export const CHANGELIST_TAG = "drifty-changelist";
export const CONFLICT_TAG = "drifty-conflict";

export const BASE = `
:host{display:block;max-width:340px;font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a}
.card{border:1px solid #e2e8f0;border-radius:12px;background:#fff;overflow:hidden}
.hd{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px}
.hd b{display:block;font-size:14px}
.muted{color:#64748b;font-size:12px}
.body{padding:8px 12px;display:grid;gap:8px}
.item{border:1px solid #e2e8f0;border-radius:10px;padding:8px;display:grid;gap:4px}
.item.rejected{opacity:.55}
.row{display:flex;align-items:center;justify-content:space-between;gap:6px}
.txt{font-size:13px;line-height:1.4}
.item.rejected .txt{text-decoration:line-through}
.tag{font-size:11px;font-weight:600;border-radius:999px;padding:1px 7px;background:#f1f5f9;color:#334155;white-space:nowrap}
.chip{font-size:11px;font-weight:600;border-radius:999px;padding:1px 7px;white-space:nowrap}
.src{font-size:12px;color:#475569;border-left:3px solid #cbd5e1;padding-left:6px;font-style:italic}
.btns{display:flex;gap:6px;flex-wrap:wrap}
button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;font-size:13px;font-weight:600;border-radius:8px;padding:6px 10px;background:#0f172a;color:#fff}
button.secondary{background:#fff;color:#0f172a;border:1px solid #cbd5e1}
button.full{width:100%;padding:9px 10px;font-size:14px}
button[disabled]{opacity:.55;cursor:default}
input,textarea{box-sizing:border-box;width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font:inherit;font-size:13px}
.err{font-size:12px;color:#b91c1c}
.ok{font-size:12px;color:#166534}
`;

export const STATUS_CHIP: Record<string, [string, string, string]> = {
  suggested: ["Suggested", "#fef3c7", "#92400e"],
  confirmed: ["Confirmed", "#dcfce7", "#166534"],
  rejected: ["Rejected", "#f1f5f9", "#64748b"],
  // Round 4 drift check verdicts
  done: ["Done", "#dcfce7", "#166534"],
  missing: ["Missing", "#fee2e2", "#991b1b"],
  reversed: ["Reversed", "#fee2e2", "#991b1b"],
  needs_check: ["Check by eye", "#e0e7ff", "#3730a3"],
};
/** After a drift check the item is the version's business: no confirm/reject buttons. */
const CHECKED = new Set(["done", "missing", "reversed", "needs_check"]);

export function el(tag: string, cls: string, text?: string) {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
export function btn(label: string, cls: string, disabled: boolean, onClick: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.disabled = disabled;
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

/** Shared base: message parsing, live metadata, guarded re-render. */
export abstract class LiveCard<T> extends HTMLElement {
  protected msg: SdkMessageLike | null = null;
  protected data: T | null = null;
  protected meta: Record<string, string> = {};
  protected busy: string | null = null;
  protected error = "";
  protected readonly root: ShadowRoot;
  private viewKey = "";
  private readonly onMeta = (e: Event) => {
    const d = (e as CustomEvent<MetadataEventDetail>).detail;
    if (!d || d.messageId !== this.msg?.messageId) return;
    this.meta = { ...this.meta, ...(liveMetadata.get(d.messageId) ?? d.metadata) };
    this.busy = null;
    this.render();
  };
  protected abstract parse(content: unknown): T | null;
  protected abstract draw(root: ShadowRoot): void;
  protected abstract stateKey(): unknown;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }
  set message(value: unknown) {
    this.msg = unwrap(value);
    this.data = this.parse(this.msg?.content);
    const loaded = this.msg?.metadata instanceof Map ? Object.fromEntries(this.msg.metadata) : {};
    const live = this.msg?.messageId ? liveMetadata.get(this.msg.messageId) : undefined;
    this.meta = { ...loaded, ...live };
    this.render();
  }
  get message() {
    return this.msg;
  }
  connectedCallback() {
    window.addEventListener(METADATA_EVENT, this.onMeta);
    this.render();
  }
  disconnectedCallback() {
    window.removeEventListener(METADATA_EVENT, this.onMeta);
  }
  protected async run(key: string, fn: () => Promise<void>, applyLocally?: () => void) {
    if (this.busy) return;
    this.busy = key;
    this.error = "";
    this.render();
    try {
      await fn();
      applyLocally?.(); // server accepted: show it now for the person who tapped
      this.busy = null;
    } catch (err) {
      this.busy = null;
      this.error = err instanceof Error ? err.message : "Something went wrong.";
    }
    this.render();
  }
  protected render() {
    const key = JSON.stringify([this.msg?.messageId, this.data, this.meta, this.busy, this.error, this.stateKey()]);
    if (key === this.viewKey) return;
    this.viewKey = key;
    this.root.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = BASE;
    this.root.append(style);
    if (!this.data) {
      this.root.append(el("div", "card", "Unsupported card"));
      return;
    }
    this.draw(this.root);
  }
}

export function defineChangeListElement(): CustomElementConstructor {
  class ChangeListElement extends LiveCard<ChangeListCard> {
    private editing: number | null = null;
    private draft = "";
    protected parse(c: unknown) {
      const p = changeListCardSchema.safeParse(c);
      return p.success ? p.data : null;
    }
    protected stateKey() {
      return [this.editing, getCardActions()?.canManage() ?? false];
    }
    protected draw(root: ShadowRoot) {
      const card = this.data!;
      const canManage = getCardActions()?.canManage() ?? false;
      const box = el("div", "card");
      const hd = el("div", "hd");
      hd.append(el("b", "", `Change list · ${card.title} v${card.version}`));
      hd.append(el("span", "muted", "Suggested by Drifty AI from the client's messages. Confirm what the team should do."));
      box.append(hd);
      const body = el("div", "body");
      let confirmed = 0;
      card.items.forEach((it, i) => {
        const m = readItemMeta(this.meta, i);
        const status = m?.s ?? it.status;
        const text = m?.t ?? it.text;
        if (status === "confirmed") confirmed++;
        const row = el("div", `item ${status}`);
        const top = el("div", "row");
        top.append(el("span", "tag", it.type === "question" ? "Question" : it.type));
        const [label, bg, fg] = STATUS_CHIP[status] ?? [status, "#f1f5f9", "#334155"];
        const chip = el("span", "chip", label);
        chip.style.background = bg;
        chip.style.color = fg;
        top.append(chip);
        row.append(top);
        if (this.editing === i) {
          const input = document.createElement("textarea");
          input.value = this.draft;
          input.rows = 2;
          input.maxLength = 1000;
          input.addEventListener("input", () => (this.draft = input.value));
          input.addEventListener("click", (e) => e.stopPropagation());
          row.append(input);
          const b = el("div", "btns");
          b.append(
            btn(this.busy === `e${i}` ? "Saving…" : "Save & confirm", "", !!this.busy, () => {
              const t = this.draft.trim();
              if (!t) return;
              void this.run(`e${i}`, () => getCardActions()!.changeItem(it.id, "edit", t), () => {
                this.meta = { ...this.meta, [`i${i}`]: JSON.stringify({ s: "confirmed", t }) };
                this.editing = null;
              });
            }),
            btn("Cancel", "secondary", !!this.busy, () => {
              this.editing = null;
              this.render();
            }),
          );
          row.append(b);
          setTimeout(() => input.focus(), 0);
        } else {
          row.append(el("div", "txt", text));
        }
        row.append(el("div", "muted", `— ${it.author}`));
        if (it.source) row.append(el("div", "src", `“${it.source}”`));
        if (canManage && this.editing !== i && !CHECKED.has(status)) {
          const b = el("div", "btns");
          if (status !== "confirmed") {
            b.append(
              btn(this.busy === `c${i}` ? "…" : "Confirm", "", !!this.busy, () =>
                void this.run(`c${i}`, () => getCardActions()!.changeItem(it.id, "confirm"), () => {
                  this.meta = { ...this.meta, [`i${i}`]: JSON.stringify({ s: "confirmed", ...(m?.t ? { t: m.t } : {}) }) };
                }),
              ),
            );
          }
          b.append(
            btn("Edit", "secondary", !!this.busy, () => {
              this.editing = i;
              this.draft = text;
              this.render();
            }),
          );
          if (status !== "rejected") {
            b.append(
              btn(this.busy === `r${i}` ? "…" : "Reject", "secondary", !!this.busy, () =>
                void this.run(`r${i}`, () => getCardActions()!.changeItem(it.id, "reject"), () => {
                  this.meta = { ...this.meta, [`i${i}`]: JSON.stringify({ s: "rejected" }) };
                }),
              ),
            );
          }
          row.append(b);
        }
        body.append(row);
      });
      if (this.meta.brief) {
        body.append(el("div", "ok", `Brief sent to the team ${new Date(this.meta.brief).toLocaleString()}.`));
      }
      if (canManage) {
        body.append(
          btn(
            this.busy === "brief" ? "Sending…" : this.meta.brief ? "Send brief again" : `Send brief (${confirmed} confirmed)`,
            "full",
            !!this.busy || confirmed === 0,
            () =>
              void this.run("brief", () => getCardActions()!.sendBrief(card.changeListId), () => {
                this.meta = { ...this.meta, brief: new Date().toISOString() };
              }),
          ),
        );
      }
      if (this.error) body.append(el("div", "err", this.error));
      box.append(body);
      root.append(box);
    }
  }
  return ChangeListElement;
}

export function defineConflictElement(): CustomElementConstructor {
  class ConflictElement extends LiveCard<ConflictCard> {
    private otherOpen = false;
    private other = "";
    protected parse(c: unknown) {
      const p = conflictCardSchema.safeParse(c);
      return p.success ? p.data : null;
    }
    protected stateKey() {
      return [this.otherOpen, getCardActions()?.canApprove() ?? false];
    }
    protected draw(root: ShadowRoot) {
      const c = this.data!;
      const box = el("div", "card");
      const hd = el("div", "hd");
      hd.append(el("b", "", `Two requests conflict · ${c.title} v${c.version}`));
      hd.append(el("span", "muted", c.summary));
      box.append(hd);
      const body = el("div", "body");
      const optA = el("div", "item");
      optA.append(el("div", "txt", `A: ${c.optionA.text}`), el("div", "muted", `— ${c.optionA.author}`));
      const optB = el("div", "item");
      optB.append(el("div", "txt", `B: ${c.optionB.text}`), el("div", "muted", `— ${c.optionB.author}`));
      body.append(optA, optB);
      const resolved = this.meta.status === "resolved";
      if (resolved) {
        body.append(el("div", "ok", `${this.meta.by ?? "The approver"} chose: “${this.meta.choice ?? ""}”`));
      } else if (getCardActions()?.canApprove()) {
        body.append(el("div", "muted", "You're the approver: which should the team do?"));
        if (this.otherOpen) {
          const ta = document.createElement("textarea");
          ta.rows = 2;
          ta.maxLength = 500;
          ta.placeholder = "Describe what you want instead";
          ta.value = this.other;
          ta.addEventListener("input", () => (this.other = ta.value));
          ta.addEventListener("click", (e) => e.stopPropagation());
          body.append(ta);
          const b = el("div", "btns");
          b.append(
            btn(this.busy === "o" ? "Sending…" : "Send", "", !!this.busy, () => {
              const t = this.other.trim();
              if (!t) return;
              void this.run("o", () => getCardActions()!.resolveConflict(c.conflictId, "other", t), () => {
                this.meta = { ...this.meta, status: "resolved", choice: t, by: "You" };
              });
            }),
            btn("Cancel", "secondary", !!this.busy, () => {
              this.otherOpen = false;
              this.render();
            }),
          );
          body.append(b);
          setTimeout(() => ta.focus(), 0);
        } else {
          const b = el("div", "btns");
          b.append(
            btn(this.busy === "a" ? "…" : "Choose A", "", !!this.busy, () =>
              void this.run("a", () => getCardActions()!.resolveConflict(c.conflictId, "a"), () => {
                this.meta = { ...this.meta, status: "resolved", choice: c.optionA.text, by: "You" };
              }),
            ),
            btn(this.busy === "b" ? "…" : "Choose B", "", !!this.busy, () =>
              void this.run("b", () => getCardActions()!.resolveConflict(c.conflictId, "b"), () => {
                this.meta = { ...this.meta, status: "resolved", choice: c.optionB.text, by: "You" };
              }),
            ),
            btn("Other", "secondary", !!this.busy, () => {
              this.otherOpen = true;
              this.render();
            }),
          );
          body.append(b);
        }
      } else {
        body.append(el("div", "muted", "Waiting for the approver to decide."));
      }
      if (this.error) body.append(el("div", "err", this.error));
      box.append(body);
      root.append(box);
    }
  }
  return ConflictElement;
}
