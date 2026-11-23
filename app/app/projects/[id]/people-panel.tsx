"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/client-fetch";

export interface PeopleData {
  members: { guestId: string; name: string; role: "approver" | "reviewer"; inviteId: string | null; linkActive: boolean }[];
  pending: { inviteId: string; name: string; contact: string; role: "approver" | "reviewer"; expiresAt: string }[];
  past: { inviteId: string; name: string; status: "cancelled" | "expired" }[];
}

/** WhatsApp green, readable white text (contrast ~4.6:1 with the darker shade). */
/** WhatsApp share: the brand lime pill with a chat icon. */
const WA_CLASS = "gap-1.5";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function PeoplePanel(props: { projectId: string; projectName: string; canManage: boolean; approverId: string | null } & PeopleData) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  // The last link we fetched/created, shown so it can be copied manually if the clipboard is blocked.
  const [shown, setShown] = useState<{ key: string; link: string; copied: boolean } | null>(null);

  async function act(key: string, fn: () => Promise<unknown>, refresh = true) {
    setBusyKey(key);
    setError("");
    try {
      await fn();
      if (refresh) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyKey(null);
    }
  }

  async function showLink(key: string, link: string) {
    setShown({ key, link, copied: await copyText(link) });
  }

  /**
   * Share the person's link on WhatsApp (wa.me opens the app on phones, WhatsApp Web on desktop).
   * The tab opens on the tap itself so pop-up blockers allow it, then goes to wa.me.
   */
  async function shareWhatsApp(inviteId: string, name: string) {
    const win = window.open("", "_blank");
    setBusyKey(`wa-${inviteId}`);
    setError("");
    try {
      const { link } = await apiJson<{ link: string }>(`/api/invites/${inviteId}/link`, { method: "GET" });
      const text = `Hi ${name}, please review ${props.projectName} on Drifty: ${link}`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (err) {
      win?.close();
      setError(err instanceof Error ? err.message : "Couldn't get the link. Try Copy link again.");
    } finally {
      setBusyKey(null);
    }
  }

  const copyAgain = (inviteId: string) =>
    act(
      `copy-${inviteId}`,
      async () => {
        try {
          const { link } = await apiJson<{ link: string }>(`/api/invites/${inviteId}/link`, { method: "GET" });
          await showLink(inviteId, link);
        } catch (err) {
          // Links made before reusable links existed can't be shown again: offer a new one.
          if (err instanceof Error && /older link/.test(err.message)) {
            const yes = window.confirm(
              "This link was created before links could be copied again. Create a new link for this person? Their old link will stop working, but they keep their chat history.",
            );
            if (!yes) return;
            const { link } = await apiJson<{ link: string }>(`/api/invites/${inviteId}/reissue`);
            await showLink(inviteId, link);
            router.refresh();
            return;
          }
          throw err;
        }
      },
      false,
    );
  const newLink = (inviteId: string) =>
    act(`new-${inviteId}`, async () => {
      const { link } = await apiJson<{ link: string }>(`/api/invites/${inviteId}/reissue`);
      await showLink(inviteId, link);
    });
  const revoke = (inviteId: string, joined: boolean) => {
    const msg = joined
      ? "Remove this person from the client room? Their link stops working right away."
      : "Cancel this invite link? It stops working right away.";
    if (!window.confirm(msg)) return;
    void act(`revoke-${inviteId}`, () => apiJson(`/api/invites/${inviteId}/revoke`));
  };

  const busy = busyKey !== null;
  const LinkBox = ({ k }: { k: string }) =>
    shown?.key === k ? (
      <div className="bg-muted mt-2 space-y-1 rounded-md p-2" role="status">
        <p className="text-xs font-medium">{shown.copied ? "Link copied. Send it on WhatsApp or email." : "Copy this link:"}</p>
        <p className="font-mono text-[11px] break-all select-all">{shown.link}</p>
      </div>
    ) : null;

  return (
    <aside className="w-full space-y-5 rounded-2xl border p-4 bg-card">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Client people</h2>
        {props.members.length === 0 ? (
          <p className="text-muted-foreground text-sm">No clients have joined yet. Invite them below.</p>
        ) : (
          <ul className="space-y-3">
            {props.members.map((m) => (
              <li key={m.guestId} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{m.name}</span>
                  {m.role === "approver" ? <Badge>Approver</Badge> : <Badge variant="secondary">Reviewer</Badge>}
                </div>
                {props.canManage && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.inviteId && m.linkActive && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => copyAgain(m.inviteId!)}>
                        {busyKey === `copy-${m.inviteId}` ? "Copying…" : "Copy link again"}
                      </Button>
                    )}
                    {m.inviteId && m.linkActive && (
                      <Button size="sm" className={WA_CLASS} disabled={busy} onClick={() => void shareWhatsApp(m.inviteId!, m.name)}>
                        <MessageCircle className="size-3.5" aria-hidden />
                        {busyKey === `wa-${m.inviteId}` ? "Opening…" : "Share on WhatsApp"}
                      </Button>
                    )}
                    {m.inviteId && !m.linkActive && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => newLink(m.inviteId!)}>
                        {busyKey === `new-${m.inviteId}` ? "Creating…" : "New link"}
                      </Button>
                    )}
                    {m.role === "reviewer" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          act(m.guestId, () =>
                            apiJson(`/api/projects/${props.projectId}`, { method: "PATCH", body: { approverId: m.guestId } }),
                          )
                        }
                      >
                        {busyKey === m.guestId ? "Saving…" : "Make approver"}
                      </Button>
                    )}
                    {m.inviteId && m.linkActive && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => revoke(m.inviteId!, true)}>
                        {busyKey === `revoke-${m.inviteId}` ? "Removing…" : "Remove"}
                      </Button>
                    )}
                  </div>
                )}
                {m.inviteId && <LinkBox k={m.inviteId} />}
              </li>
            ))}
          </ul>
        )}
        {props.members.length > 0 && !props.approverId && (
          <p className="text-xs text-beige-100">Nobody can approve yet. Mark one person as the approver.</p>
        )}
      </section>

      {props.canManage && props.pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Invited, not joined yet</h2>
          <ul className="space-y-3">
            {props.pending.map((i) => (
              <li key={i.inviteId} className="text-sm">
                <span className="block truncate font-medium">{i.name}</span>
                <span className="text-muted-foreground block text-xs">
                  {i.role === "approver" ? "Approver" : "Reviewer"} · link valid until {shortDate(i.expiresAt)}
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => copyAgain(i.inviteId)}>
                    {busyKey === `copy-${i.inviteId}` ? "Copying…" : "Copy link again"}
                  </Button>
                  <Button size="sm" className={WA_CLASS} disabled={busy} onClick={() => void shareWhatsApp(i.inviteId, i.name)}>
                    <MessageCircle className="size-3.5" aria-hidden />
                    {busyKey === `wa-${i.inviteId}` ? "Opening…" : "Share on WhatsApp"}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => revoke(i.inviteId, false)}>
                    {busyKey === `revoke-${i.inviteId}` ? "Cancelling…" : "Cancel"}
                  </Button>
                </div>
                <LinkBox k={i.inviteId} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {props.canManage && <InviteForm projectId={props.projectId} hasApprover={Boolean(props.approverId)} />}

      {props.canManage && props.past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Cancelled or expired links</h2>
          <ul className="space-y-3">
            {props.past.map((i) => (
              <li key={i.inviteId} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{i.name}</span>
                    <span className="text-muted-foreground block text-xs">{i.status === "cancelled" ? "Cancelled" : "Expired"}</span>
                  </span>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => newLink(i.inviteId)}>
                    {busyKey === `new-${i.inviteId}` ? "Creating…" : "New link"}
                  </Button>
                </div>
                <LinkBox k={i.inviteId} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}

function InviteForm({ projectId, hasApprover }: { projectId: string; hasApprover: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<"approver" | "reviewer">(hasApprover ? "reviewer" : "approver");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || contact.trim().length < 3) {
      setError("Add their name and email or phone.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await apiJson<{ link: string }>("/api/invites", {
        body: { projectId, name, emailOrPhone: contact, role },
      });
      setLink(res.link);
      setCopied(await copyText(res.link));
      setName("");
      setContact("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Invite a client</h2>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="inv-name">Name</Label>
          <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder="Priya Sharma" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-contact">Email or phone</Label>
          <Input id="inv-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder="priya@brand.com" />
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Role</legend>
          <div className="flex gap-2">
            {(["approver", "reviewer"] as const).map((r) => (
              <label
                key={r}
                className={`flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm ${role === r ? "border-foreground bg-muted font-medium" : ""}`}
              >
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                {r === "approver" ? "Approver" : "Reviewer"}
              </label>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {role === "approver"
              ? "Can approve drafts. Only one approver per project; this replaces the current one."
              : "Can chat, send voice notes and comment, but can't approve."}
          </p>
        </fieldset>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating link…" : "Create invite link"}
        </Button>
      </form>

      {link && (
        <div className="bg-muted space-y-2 rounded-md p-3" role="status">
          <p className="text-xs font-medium">
            {copied ? "Link copied. " : ""}Send it on WhatsApp or email. It&apos;s personal to this client, works on any
            device for 30 days, and you can cancel it any time.
          </p>
          <p className="font-mono text-xs break-all select-all">{link}</p>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={async () => setCopied(await copyText(link))}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}
    </section>
  );
}
