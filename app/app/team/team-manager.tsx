"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/client-fetch";
import { TEAM_ROLE_LABEL, type TeamRole } from "@/lib/team/rules";

interface Member {
  userId: string;
  role: "owner" | TeamRole;
  name: string;
  email: string | null;
  you: boolean;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function TeamManager({
  members,
  invites,
  canInvite,
  isOwner,
}: {
  members: Member[];
  invites: { id: string; role: TeamRole; expiresAt: string }[];
  canInvite: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<TeamRole>("creative");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ url: string; copied: boolean } | null>(null);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  async function invite() {
    await act("invite", async () => {
      const r = await apiJson<{ link: string }>("/api/team/invites", { body: { role } });
      setLink({ url: r.link, copied: await copyText(r.link) });
    });
  }

  function shareWhatsApp(url: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(`Join our team on Drifty: ${url}`)}`, "_blank", "noopener");
  }

  return (
    <div className="space-y-5">
      {canInvite && (
        <section className="space-y-3 rounded-2xl border p-4 bg-card" aria-label="Invite a teammate">
          <h2 className="font-semibold">Invite a teammate</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRole)}
              className="border-input bg-muted/60 h-9 rounded-xl border px-3 text-sm"
            >
              <option value="creative">Creative</option>
              {isOwner && <option value="am">Account manager</option>}
            </select>
            <Button onClick={() => void invite()} disabled={busy !== ""}>
              {busy === "invite" ? "Creating…" : "Create invite link"}
            </Button>
          </div>
          {link && (
            <div className="bg-muted/40 space-y-2 rounded-xl border p-3 text-sm" role="status">
              <p>{link.copied ? "Link copied. Send it to your teammate (works once, for 7 days):" : "Copy this link and send it to your teammate (works once, for 7 days):"}</p>
              <p className="font-mono text-xs break-all select-all">{link.url}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void copyText(link.url).then((c) => setLink({ ...link, copied: c }))}>
                  Copy
                </Button>
                <Button size="sm" variant="outline" onClick={() => shareWhatsApp(link.url)}>
                  Share on WhatsApp
                </Button>
              </div>
            </div>
          )}
          {invites.length > 0 && (
            <ul className="divide-y text-sm">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {TEAM_ROLE_LABEL[i.role]} link <span className="text-muted-foreground">· until {shortDate(i.expiresAt)}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== ""}
                    onClick={() => void act(`rv-${i.id}`, () => apiJson(`/api/team/invites/${i.id}`, { method: "DELETE" }))}
                  >
                    {busy === `rv-${i.id}` ? "…" : "Cancel link"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-2xl border bg-card" aria-label="Team members">
        <h2 className="border-b p-3 font-semibold">Members ({members.length})</h2>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.name} {m.you && <span className="text-muted-foreground font-normal">(you)</span>}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {TEAM_ROLE_LABEL[m.role]}
                  {m.email ? ` · ${m.email}` : ""}
                </p>
              </div>
              {isOwner && m.role !== "owner" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== ""}
                  onClick={() => {
                    if (window.confirm(`Remove ${m.name} from the team? They lose access to every project.`)) {
                      void act(`rm-${m.userId}`, () => apiJson(`/api/team/members/${m.userId}`, { method: "DELETE" }));
                    }
                  }}
                >
                  {busy === `rm-${m.userId}` ? "Removing…" : "Remove"}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {members.length === 1 && <p className="text-muted-foreground border-t p-3 text-xs">Just you so far. Invite a creative or an account manager above.</p>}
      </section>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
