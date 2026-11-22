"use client";
import { driftCardSchema, type DriftCard } from "@/lib/drift/cards";
import { driftCounts, sendLabel } from "@/lib/drift/rules";
import { getCardActions } from "./deliverable-card-element";
import { btn, el, LiveCard, STATUS_CHIP } from "./feedback-cards";

/**
 * `drifty:drift` (internal room, FR-11): AI-3's verdict per confirmed change for a held
 * version. Owners/AMs choose "Send to client" or "Back to creative"; the server writes the
 * outcome into the card's metadata so every teammate sees it live.
 */
export const DRIFT_TAG = "drifty-drift";

const DONE_TEXT: Record<string, string> = {
  sent: "Sent to the client",
  back: "Sent back to the creative",
  superseded: "Replaced by a newer version",
};

export function defineDriftElement(): CustomElementConstructor {
  class DriftElement extends LiveCard<DriftCard> {
    protected parse(c: unknown) {
      const p = driftCardSchema.safeParse(c);
      return p.success ? p.data : null;
    }
    protected stateKey() {
      return [getCardActions()?.canManage() ?? false];
    }
    protected draw(root: ShadowRoot) {
      const card = this.data!;
      const box = el("div", "card");
      const hd = el("div", "hd");
      hd.append(el("b", "", `Drift check · ${card.title} v${card.fromVersion} → v${card.toVersion}`));
      const c = driftCounts(card.results);
      const parts = [
        c.done && `${c.done} done`,
        c.missing && `${c.missing} missing`,
        c.reversed && `${c.reversed} reversed`,
        c.needs_check && `${c.needs_check} to check by eye`,
      ].filter(Boolean);
      hd.append(
        el(
          "span",
          "muted",
          card.aiChecked
            ? `${parts.join(" · ")}. The client hasn't seen v${card.toVersion} yet.`
            : `The AI couldn't run, so check each change by eye. The client hasn't seen v${card.toVersion} yet.`,
        ),
      );
      box.append(hd);
      const body = el("div", "body");
      const link = document.createElement("a");
      link.href = `/api/assets/${card.toVersionId}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = `Open v${card.toVersion} ↗`;
      link.style.cssText = "font-size:13px;color:#20799c;font-weight:600";
      link.addEventListener("click", (e) => e.stopPropagation());
      body.append(link);
      for (const r of card.results) {
        const row = el("div", "item");
        const top = el("div", "row");
        top.append(el("span", "tag", r.type));
        const [label, bg, fg] = STATUS_CHIP[r.verdict] ?? [r.verdict, "#eff3ef", "#24343a"];
        const chip = el("span", "chip", label);
        chip.style.background = bg;
        chip.style.color = fg;
        top.append(chip);
        row.append(top, el("div", "txt", r.text));
        if (r.note) row.append(el("div", "src", r.note));
        body.append(row);
      }
      const status = this.meta.status ?? "open";
      if (status !== "open") {
        const by = this.meta.by ? ` by ${this.meta.by}` : "";
        body.append(el("div", status === "superseded" ? "muted" : "ok", `${DONE_TEXT[status] ?? status}${by}.`));
      } else if (getCardActions()?.canManage()) {
        const b = el("div", "btns");
        const allDone = card.results.every((r) => r.verdict === "done");
        b.append(
          btn(this.busy === "send" ? "Sending…" : sendLabel(card.results, card.toVersion), allDone ? "" : "secondary", !!this.busy, () =>
            void this.run("send", () => getCardActions()!.decideDrift(card.alertId, "send"), () => {
              this.meta = { ...this.meta, status: "sent", by: "you" };
            }),
          ),
          btn(this.busy === "back" ? "Sending…" : "Back to creative", allDone ? "secondary" : "", !!this.busy, () =>
            void this.run("back", () => getCardActions()!.decideDrift(card.alertId, "back"), () => {
              this.meta = { ...this.meta, status: "back", by: "you" };
            }),
          ),
        );
        body.append(b);
      } else {
        body.append(el("div", "muted", "Waiting for the account manager to decide."));
      }
      if (this.error) body.append(el("div", "err", this.error));
      box.append(body);
      root.append(box);
    }
  }
  return DriftElement;
}
