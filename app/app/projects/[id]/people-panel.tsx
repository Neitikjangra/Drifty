"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/client-fetch";
import type { ProjectGuest } from "@/lib/db/types";

export interface InviteRow {
  id: string;
  name: string | null;
  contact: string;
  role: "approver" | "reviewer";
  expiresAt: string;
  status: "pending" | "joined" | "revoked" | "expired";
}

export function PeoplePanel(props: {
  projectId: string;
  canManage: boolean;
  guests: ProjectGuest[];
  approverId: string | null;
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = props.invites.filter((i) => i.status === "pending");

  return (
    <aside className="w-full space-y-5 rounded-lg border p-4 lg:w-80 lg:shrink-0">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Client people</h2>
        {props.guests.length === 0 ? (
          <p className="text-muted-foreground text-sm">No clients have joined yet. Invite them below.</p>
        ) : (
          <ul className="space-y-2">
            {props.guests.map((g) => (
              <li key={g.user_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{g.display_name}</span>
                {g.role === "approver" ? (
                  <Badge>Approver</Badge>
                ) : props.canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId !== null}
                    onClick={() =>
                      act(g.user_id, () =>
                        apiJson(`/api/projects/${props.projectId}`, { method: "PATCH", body: { approverId: g.user_id } }),
                      )
                    }
                  >
                    {busyId === g.user_id ? "Saving…" : "Make approver"}
                  </Button>
                ) : (
                  <Badge variant="secondary">Reviewer</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        {props.guests.length > 0 && !props.approverId && (
          <p className="text-xs text-amber-700">Nobody can approve yet. Mark one person as the approver.</p>
        )}
      </section>

      {props.canManage && <InviteForm projectId={props.projectId} hasApprover={Boolean(props.approverId)} />}

      {props.canManage && pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Pending invites</h2>
          <ul className="space-y-2">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{i.name ?? i.contact}</span>
                  <span className="text-muted-foreground block text-xs">
                    {i.role === "approver" ? "Approver" : "Reviewer"} · expires{" "}
                    {new Date(i.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId !== null}
                  onClick={() => act(i.id, () => apiJson(`/api/invites/${i.id}/revoke`))}
                >
                  {busyId === i.id ? "Cancelling…" : "Cancel"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
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
      setCopied(false);
      setName("");
      setContact("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invite.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
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
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating link…" : "Create invite link"}
        </Button>
      </form>

      {link && (
        <div className="bg-muted space-y-2 rounded-md p-3" role="status">
          <p className="text-xs font-medium">Share this link (WhatsApp or email). It works once and expires in 7 days.</p>
          <p className="break-all font-mono text-xs">{link}</p>
          <Button size="sm" variant="outline" onClick={copy} className="w-full">
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}
    </section>
  );
}
