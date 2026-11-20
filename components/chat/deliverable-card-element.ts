"use client";
import { deliverableCardSchema, resolveStatus, STATUS_LABEL, type DeliverableCard, type DeliverableStatus } from "@/lib/cards";

/**
 * Web Component for `drifty:deliverable`. ChatUI renders it as `nc-c-drifty-deliverable`
 * and sets `.message` (a ChatUIMessageModel wrapping the Chat SDK Message).
 * Status is read from server-written message metadata and updated live from
 * `drifty:metadata` window events (fed by NCEngine's onMessageMetadataUpdated).
 */

export const CARD_TAG = "drifty-deliverable";
export const METADATA_EVENT = "drifty:metadata";

export interface MetadataEventDetail {
  messageId: string;
  metadata: Record<string, string>;
}

export interface CardActions {
  /** Server call that approves; resolves when the server accepted it. */
  approve(messageId: string): Promise<void>;
  canApprove(): boolean;
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
const liveMetadata = new Map<string, Record<string, string>>();
export function recordLiveMetadata(messageId: string, metadata: Record<string, string>) {
  liveMetadata.set(messageId, { ...liveMetadata.get(messageId), ...metadata });
}
export function clearLiveMetadata() {
  liveMetadata.clear();
}

interface SdkMessageLike {
  messageId?: string;
  content?: unknown;
  metadata?: Map<string, string>;
}

function unwrap(value: unknown): SdkMessageLike | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { message?: SdkMessageLike } & SdkMessageLike;
  // ChatUIMessageModel has `.message`; a raw Message has `.messageId`.
  if (v.message && typeof v.message === "object" && "messageId" in v.message) return v.message;
  return v;
}

const CHIP: Record<DeliverableStatus, { bg: string; fg: string }> = {
  draft: { bg: "#f1f5f9", fg: "#334155" },
  in_review: { bg: "#fef3c7", fg: "#92400e" },
  changes_requested: { bg: "#fee2e2", fg: "#991b1b" },
  approved: { bg: "#dcfce7", fg: "#166534" },
};

const STYLE = `
:host{display:block;max-width:300px;font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a}
.card{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff}
img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#f8fafc}
.body{padding:10px 12px;display:grid;gap:6px}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.title{font-weight:600;font-size:14px;line-height:1.3}
.ver{font-size:12px;color:#64748b}
.copy{font-size:13px;color:#334155;line-height:1.4;white-space:pre-wrap}
.chip{font-size:12px;font-weight:600;border-radius:999px;padding:2px 8px;white-space:nowrap;transition:background .2s}
button{all:unset;cursor:pointer;text-align:center;font-size:14px;font-weight:600;border-radius:8px;padding:9px 12px;background:#0f172a;color:#fff;min-height:20px}
button[disabled]{opacity:.55;cursor:default}
.err{font-size:12px;color:#b91c1c}
.meta{font-size:12px;color:#166534}
`;

export function defineDeliverableCardElement(): CustomElementConstructor {
  class DeliverableCardElement extends HTMLElement {
    private _message: SdkMessageLike | null = null;
    private _card: DeliverableCard | null = null;
    private _status: DeliverableStatus = "in_review";
    private _meta: Record<string, string> = {};
    private _busy = false;
    private _error = "";
    private readonly _root: ShadowRoot;
    private readonly _onMeta = (e: Event) => {
      const d = (e as CustomEvent<MetadataEventDetail>).detail;
      if (!d || !this._message?.messageId || d.messageId !== this._message.messageId) return;
      this._meta = { ...this._meta, ...(liveMetadata.get(d.messageId) ?? d.metadata) };
      if (this._card) this._status = resolveStatus(this._card, this._meta);
      this._busy = false;
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

    private async approve() {
      const id = this._message?.messageId;
      if (!id || !actions || this._busy) return;
      this._busy = true;
      this._error = "";
      this.render();
      try {
        await actions.approve(id);
        // The chip turns green when the metadata event arrives (same path as other viewers).
      } catch {
        this._busy = false;
        this._error = "Couldn't approve. Please try again.";
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
      const box = el("div", "card");
      if (!card) {
        box.append(el("div", "body", "Unsupported card"));
        root.append(box);
        return;
      }

      const img = document.createElement("img");
      img.src = card.imageUrl;
      img.alt = card.title;
      img.loading = "lazy";
      box.append(img);

      const body = el("div", "body");
      const head = el("div", "row");
      head.append(el("div", "title", card.title));
      const chip = el("span", "chip", STATUS_LABEL[this._status]);
      chip.style.background = CHIP[this._status].bg;
      chip.style.color = CHIP[this._status].fg;
      chip.setAttribute("role", "status");
      head.append(chip);
      body.append(head);
      body.append(el("div", "ver", `Version ${card.version}`));
      if (card.copy) body.append(el("div", "copy", card.copy));

      if (this._status === "approved") {
        const by = this._meta.actedBy;
        body.append(el("div", "meta", by ? `Approved by ${by}` : "Approved"));
      } else if (actions?.canApprove()) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = this._busy ? "Approving…" : `Approve v${card.version}`;
        btn.disabled = this._busy;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          void this.approve();
        });
        body.append(btn);
      }
      if (this._error) body.append(el("div", "err", this._error));
      box.append(body);
      root.append(box);
    }
  }
  return DeliverableCardElement;
}

function el(tag: string, cls: string, text?: string) {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
