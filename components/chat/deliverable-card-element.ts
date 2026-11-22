"use client";
import {
  deliverableCardSchema,
  receiptCardSchema,
  resolveStatus,
  STATUS_LABEL,
  type CardStatus,
  type DeliverableCard,
} from "@/lib/cards";

/**
 * Web Components for `drifty:deliverable` and `drifty:receipt`. ChatUI renders them as
 * `nc-c-<tag>` and sets `.message` (a ChatUIMessageModel wrapping the Chat SDK Message).
 * Status is read from server-written message metadata and updated live from
 * `drifty:metadata` window events (fed by NCEngine's onMessageMetadataUpdated).
 * Buttons only call our API; the server decides and writes the status (FR-5/FR-6).
 */

export const CARD_TAG = "drifty-deliverable";
export const RECEIPT_TAG = "drifty-receipt";
export const METADATA_EVENT = "drifty:metadata";

export interface MetadataEventDetail {
  messageId: string;
  metadata: Record<string, string>;
}

export interface CardActions {
  /** True only for the project's approver (the server checks again). */
  canApprove(): boolean;
  approve(versionId: string): Promise<void>;
  requestChanges(versionId: string, note: string): Promise<void>;
  /** True for owners/AMs in the agency view (change lists). */
  canManage(): boolean;
  changeItem(itemId: string, action: "confirm" | "reject" | "edit", text?: string): Promise<void>;
  sendBrief(changeListId: string): Promise<void>;
  resolveConflict(conflictId: string, choice: "a" | "b" | "other", text?: string): Promise<void>;
  /** Owner/AM decision on a held version (FR-11). */
  decideDrift(alertId: string, action: "send" | "back"): Promise<void>;
  /** The approver's answer to "Does this approve all of vX?" (FR-16). */
  answerApprovalCheck(alertId: string, answer: "yes" | "no"): Promise<void>;
  /** Owner/AM: send or discard the scope note (FR-15). */
  decideScope(alertId: string, action: "send" | "discard", text?: string): Promise<void>;
}
export function getCardActions() {
  return actions;
}

let actions: CardActions | null = null;
export function configureCardActions(a: CardActions | null) {
  actions = a;
}

/**
 * Latest live metadata per message id. ChatUI can re-set `.message` (or re-mount the
 * element) with its cached model, whose metadata is from load time; merging this cache
 * keeps the newer server-written status from being overwritten.
 */
export const liveMetadata = new Map<string, Record<string, string>>();
export function recordLiveMetadata(messageId: string, metadata: Record<string, string>) {
  liveMetadata.set(messageId, { ...liveMetadata.get(messageId), ...metadata });
}
export function clearLiveMetadata() {
  liveMetadata.clear();
}

export interface SdkMessageLike {
  messageId?: string;
  content?: unknown;
  metadata?: Map<string, string>;
}

export function unwrap(value: unknown): SdkMessageLike | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { message?: SdkMessageLike } & SdkMessageLike;
  // ChatUIMessageModel has `.message`; a raw Message has `.messageId`.
  if (v.message && typeof v.message === "object" && "messageId" in v.message) return v.message;
  return v;
}

const CHIP: Record<CardStatus, { bg: string; fg: string }> = {
  draft: { bg: "#dde7ea", fg: "#24343a" },
  in_review: { bg: "#fef3c7", fg: "#92400e" },
  changes_requested: { bg: "#ffedd5", fg: "#9a3412" },
  approved: { bg: "#dcfce7", fg: "#166534" },
  superseded: { bg: "#eff3ef", fg: "#476874" },
};

const STYLE = `
:host{display:block;max-width:300px;font-family:ui-sans-serif,system-ui,sans-serif;color:#01161e}
.card{border:1px solid #bdcebf;border-radius:12px;overflow:hidden;background:#fcfdf9}
.card.old{opacity:.7}
img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#f5f9ec}
.file{display:flex;align-items:center;gap:8px;padding:14px 12px;background:#f5f9ec;font-size:13px;color:#01161e;text-decoration:none;border-bottom:1px solid #bdcebf}
.body{padding:10px 12px;display:grid;gap:6px}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.title{font-weight:600;font-size:14px;line-height:1.3}
.ver{font-size:12px;color:#476874}
.copy{font-size:13px;color:#24343a;line-height:1.4;white-space:pre-wrap}
.chip{font-size:12px;font-weight:600;border-radius:999px;padding:2px 8px;white-space:nowrap;transition:background .2s}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:6px}
button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;font-size:14px;font-weight:600;border-radius:8px;padding:9px 10px;background:#124559;color:#fcfdf9;min-height:20px}
button.secondary{background:#fcfdf9;color:#01161e;border:1px solid #aec3b0}
button[disabled]{opacity:.55;cursor:default}
textarea{box-sizing:border-box;width:100%;min-height:64px;border:1px solid #aec3b0;border-radius:8px;padding:8px;font:inherit;font-size:14px;resize:vertical}
.err{font-size:12px;color:#b91c1c}
.meta{font-size:12px;color:#3e5441}
.muted{font-size:12px;color:#476874}
`;

function el(tag: string, cls: string, text?: string) {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function defineDeliverableCardElement(): CustomElementConstructor {
  class DeliverableCardElement extends HTMLElement {
    private _message: SdkMessageLike | null = null;
    private _card: DeliverableCard | null = null;
    private _status: CardStatus = "in_review";
    private _meta: Record<string, string> = {};
    private _busy = false;
    private _error = "";
    private _noteOpen = false;
    private _note = "";
    private readonly _root: ShadowRoot;
    private readonly _onMeta = (e: Event) => {
      const d = (e as CustomEvent<MetadataEventDetail>).detail;
      if (!d || !this._message?.messageId || d.messageId !== this._message.messageId) return;
      this._meta = { ...this._meta, ...(liveMetadata.get(d.messageId) ?? d.metadata) };
      if (this._card) this._status = resolveStatus(this._card, this._meta);
      this._busy = false;
      this._noteOpen = false;
      this.render();
    };

    constructor() {
      super();
      this._root = this.attachShadow({ mode: "open" });
    }

    set message(value: unknown) {
      this._message = unwrap(value);
      const parsed = deliverableCardSchema.safeParse(this._message?.content);
      this._card = parsed.success ? parsed.data : null;
      const loaded = this._message?.metadata instanceof Map ? Object.fromEntries(this._message.metadata) : {};
      const live = this._message?.messageId ? liveMetadata.get(this._message.messageId) : undefined;
      this._meta = { ...loaded, ...live };
      if (this._card) this._status = resolveStatus(this._card, this._meta);
      this.render();
    }
    get message() {
      return this._message;
    }

    connectedCallback() {
      window.addEventListener(METADATA_EVENT, this._onMeta);
      this.render();
    }
    disconnectedCallback() {
      window.removeEventListener(METADATA_EVENT, this._onMeta);
    }

    private async run(fn: () => Promise<void>, confirmed: CardStatus) {
      if (this._busy) return;
      this._busy = true;
      this._error = "";
      this.render();
      try {
        await fn();
        // The server accepted and already wrote the status; show it now for the person who
        // tapped. Everyone else (and this card again) gets it from the live metadata event.
        this._status = confirmed;
        this._busy = false;
        this._noteOpen = false;
        this.render();
      } catch (err) {
        this._busy = false;
        this._error = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        this.render();
      }
    }

    /**
     * Rebuilds the shadow DOM only when what is shown changes. ChatUI re-sets
     * `.message` and detaches/re-attaches bubbles on hover; rebuilding then would
     * swap the button out from under the pointer and swallow the click.
     */
    private _viewKey = "";
    private render() {
      const key = JSON.stringify([
        this._message?.messageId ?? null,
        this._card,
        this._status,
        this._meta.actedBy ?? null,
        this._busy,
        this._error,
        this._noteOpen,
        actions?.canApprove() ?? false,
      ]);
      if (key === this._viewKey) return;
      this._viewKey = key;

      const root = this._root;
      root.innerHTML = "";
      const style = document.createElement("style");
      style.textContent = STYLE;
      root.append(style);

      const card = this._card;
      const box = el("div", this._status === "superseded" ? "card old" : "card");
      if (!card) {
        box.append(el("div", "body", "Unsupported card"));
        root.append(box);
        return;
      }

      if (card.assetKind === "pdf") {
        const a = document.createElement("a");
        a.className = "file";
        a.href = card.imageUrl;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = `📄 Open PDF (v${card.version})`;
        box.append(a);
      } else {
        const img = document.createElement("img");
        img.src = card.imageUrl;
        img.alt = card.title;
        img.loading = "lazy";
        box.append(img);
      }

      const body = el("div", "body");
      const head = el("div", "row");
      head.append(el("div", "title", card.title));
      const chip = el("span", "chip", STATUS_LABEL[this._status]);
      chip.style.background = CHIP[this._status].bg;
      chip.style.color = CHIP[this._status].fg;
      chip.setAttribute("role", "status");
      head.append(chip);
      body.append(head);
      const due = fmtDate(card.dueDate);
      body.append(el("div", "ver", `Version ${card.version}${due ? ` · due ${due}` : ""}`));
      if (card.copy) body.append(el("div", "copy", card.copy));

      const by = this._meta.actedBy;
      if (this._status === "approved") {
        body.append(el("div", "meta", by ? `Approved by ${by}` : "Approved"));
      } else if (this._status === "superseded") {
        body.append(el("div", "muted", "A newer version was posted below."));
      } else {
        if (this._status === "changes_requested") {
          body.append(el("div", "muted", by ? `Changes requested by ${by}` : "Changes requested"));
        }
        if (actions?.canApprove()) this.renderActions(body, card);
      }
      if (this._error) body.append(el("div", "err", this._error));
      box.append(body);
      root.append(box);
    }

    private renderActions(body: HTMLElement, card: DeliverableCard) {
      if (this._noteOpen) {
        const ta = document.createElement("textarea");
        ta.placeholder = "What should change? (optional)";
        ta.value = this._note;
        ta.maxLength = 2000;
        ta.addEventListener("input", () => (this._note = ta.value));
        ta.addEventListener("click", (e) => e.stopPropagation());
        body.append(ta);
        const row = el("div", "btns");
        const cancel = document.createElement("button");
        cancel.className = "secondary";
        cancel.textContent = "Cancel";
        cancel.disabled = this._busy;
        cancel.addEventListener("click", (e) => {
          e.stopPropagation();
          this._noteOpen = false;
          this.render();
        });
        const send = document.createElement("button");
        send.textContent = this._busy ? "Sending…" : "Send";
        send.disabled = this._busy;
        send.addEventListener("click", (e) => {
          e.stopPropagation();
          void this.run(() => actions!.requestChanges(card.versionId, this._note.trim()), "changes_requested");
        });
        row.append(cancel, send);
        body.append(row);
        setTimeout(() => ta.focus(), 0);
        return;
      }
      const row = el("div", "btns");
      const approve = document.createElement("button");
      approve.type = "button";
      approve.textContent = this._busy ? "Approving…" : `Approve v${card.version}`;
      approve.disabled = this._busy;
      approve.addEventListener("click", (e) => {
        e.stopPropagation();
        void this.run(() => actions!.approve(card.versionId), "approved");
      });
      row.append(approve);
      if (this._status !== "changes_requested") {
        const changes = document.createElement("button");
        changes.type = "button";
        changes.className = "secondary";
        changes.textContent = "Request changes";
        changes.disabled = this._busy;
        changes.addEventListener("click", (e) => {
          e.stopPropagation();
          this._noteOpen = true;
          this.render();
        });
        row.append(changes);
      } else {
        approve.style.gridColumn = "1 / -1";
      }
      body.append(row);
    }
  }
  return DeliverableCardElement;
}

/** `drifty:receipt`: a small, read-only approval receipt. */
export function defineReceiptElement(): CustomElementConstructor {
  class ReceiptElement extends HTMLElement {
    private readonly _root: ShadowRoot;
    private _key = "";
    constructor() {
      super();
      this._root = this.attachShadow({ mode: "open" });
    }
    set message(value: unknown) {
      const m = unwrap(value);
      const parsed = receiptCardSchema.safeParse(m?.content);
      const key = JSON.stringify(parsed.success ? parsed.data : null);
      if (key === this._key) return;
      this._key = key;
      this._root.innerHTML = "";
      const style = document.createElement("style");
      style.textContent = `:host{display:block;max-width:300px;font-family:ui-sans-serif,system-ui,sans-serif}
.r{border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;padding:10px 12px;font-size:13px;color:#14532d;display:grid;gap:2px}
.t{font-weight:600}.s{font-size:12px;color:#3e5441}`;
      const box = el("div", "r");
      if (parsed.success) {
        const r = parsed.data;
        box.append(el("div", "t", `✓ Approved${r.title ? `: ${r.title}` : ""}${r.version ? ` v${r.version}` : ""}`));
        const when = new Date(r.approvedAt);
        box.append(el("div", "s", `by ${r.approver} · ${Number.isNaN(when.getTime()) ? "" : when.toLocaleString()}`));
        box.append(el("div", "s", "Recorded in the approval ledger."));
      } else {
        box.append(el("div", "t", "Approval recorded"));
      }
      this._root.append(style, box);
    }
  }
  return ReceiptElement;
}
