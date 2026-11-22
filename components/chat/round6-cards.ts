"use client";
import { approvalCheckCardSchema, scopeCardSchema, type ApprovalCheckCard, type ScopeCard } from "@/lib/round6/cards";
import { getCardActions } from "./deliverable-card-element";
import { btn, el, LiveCard } from "./feedback-cards";

/**
 * `drifty:approvalcheck` (client room, FR-16) and `drifty:scope` (internal room, FR-15).
 * Buttons only call our API; the server checks who's asking and writes the outcome into the
 * card's metadata, so everyone's card updates live.
 */
export const APPROVAL_CHECK_TAG = "drifty-approvalcheck";
export const SCOPE_TAG = "drifty-scope";

export function defineApprovalCheckElement(): CustomElementConstructor {
  class ApprovalCheckElement extends LiveCard<ApprovalCheckCard> {
    protected parse(c: unknown) {
      const p = approvalCheckCardSchema.safeParse(c);
      return p.success ? p.data : null;
    }
    protected stateKey() {
      return [getCardActions()?.canApprove() ?? false];
    }
    protected draw(root: ShadowRoot) {
      const c = this.data!;
      const box = el("div", "card");
      const hd = el("div", "hd");
      hd.append(el("b", "", `Does this approve all of ${c.title} v${c.version}?`));
      hd.append(el("span", "muted", `${c.approver} wrote “${c.quote}”. To keep a clear record, please confirm.`));
      box.append(hd);
      const body = el("div", "body");
      const status = this.meta.status ?? "open";
      if (status === "yes") body.append(el("div", "ok", `${this.meta.by ?? c.approver} approved v${c.version}.`));
      else if (status === "no") body.append(el("div", "muted", `${this.meta.by ?? c.approver} said it's not an approval yet.`));
      else if (getCardActions()?.canApprove()) {
        const b = el("div", "btns");
        b.append(
          btn(this.busy === "yes" ? "Approving…" : `Yes, approve v${c.version}`, "", !!this.busy, () =>
            void this.run("yes", () => getCardActions()!.answerApprovalCheck(c.alertId, "yes"), () => {
              this.meta = { ...this.meta, status: "yes", by: "You" };
            }),
          ),
          btn(this.busy === "no" ? "…" : "No, not yet", "secondary", !!this.busy, () =>
            void this.run("no", () => getCardActions()!.answerApprovalCheck(c.alertId, "no"), () => {
              this.meta = { ...this.meta, status: "no", by: "You" };
            }),
          ),
        );
        body.append(b);
      } else body.append(el("div", "muted", `Waiting for ${c.approver} to confirm.`));
      if (this.error) body.append(el("div", "err", this.error));
      box.append(body);
      root.append(box);
    }
  }
  return ApprovalCheckElement;
}

export function defineScopeElement(): CustomElementConstructor {
  class ScopeElement extends LiveCard<ScopeCard> {
    private draft: string | null = null;
    protected parse(c: unknown) {
      const p = scopeCardSchema.safeParse(c);
      return p.success ? p.data : null;
    }
    protected stateKey() {
      return [getCardActions()?.canManage() ?? false];
    }
    protected draw(root: ShadowRoot) {
      const c = this.data!;
      const box = el("div", "card");
      const hd = el("div", "hd");
      hd.append(el("b", "", `Scope · ${c.title}: round ${c.roundsUsed} of ${c.roundsIncluded} included`));
      hd.append(
        el(
          "span",
          "muted",
          c.state === "over"
            ? "This deliverable is past the revision rounds in your agreement. Drifty AI drafted a note for the client."
            : "This version uses the last included revision round. Drifty AI drafted a note for the client.",
        ),
      );
      box.append(hd);
      const body = el("div", "body");
      const status = this.meta.status ?? "open";
      if (status === "sent") {
        body.append(el("div", "src", `“${this.meta.text ?? c.draft}”`));
        body.append(el("div", "ok", `Sent to the client by ${this.meta.by ?? "the team"}.`));
      } else if (status === "discarded") {
        body.append(el("div", "muted", `Discarded by ${this.meta.by ?? "the team"}.`));
      } else if (getCardActions()?.canManage()) {
        const ta = document.createElement("textarea");
        ta.rows = 4;
        ta.maxLength = 600;
        ta.value = this.draft ?? c.draft;
        ta.addEventListener("input", () => (this.draft = ta.value));
        ta.addEventListener("click", (e) => e.stopPropagation());
        body.append(ta);
        const b = el("div", "btns");
        b.append(
          btn(this.busy === "send" ? "Sending…" : "Send to client", "", !!this.busy, () => {
            const text = (this.draft ?? c.draft).trim();
            if (text.length < 10) {
              this.error = "Write a short note first.";
              this.render();
              return;
            }
            void this.run("send", () => getCardActions()!.decideScope(c.alertId, "send", text), () => {
              this.meta = { ...this.meta, status: "sent", by: "you", text };
            });
          }),
          btn(this.busy === "discard" ? "…" : "Discard", "secondary", !!this.busy, () =>
            void this.run("discard", () => getCardActions()!.decideScope(c.alertId, "discard"), () => {
              this.meta = { ...this.meta, status: "discarded", by: "you" };
            }),
          ),
        );
        body.append(b);
      } else body.append(el("div", "src", `“${c.draft}”`));
      if (this.error) body.append(el("div", "err", this.error));
      box.append(body);
      root.append(box);
    }
  }
  return ScopeElement;
}
