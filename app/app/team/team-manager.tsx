"use client";

import { Crown, MessageCircle, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { apiJson } from "@/lib/client-fetch";
import { jobRole, roleLabel, type JobRoleId, type TeamRole } from "@/lib/team/rules";
import { RolePicker, ROLE_ICON } from "./role-picker";

interface Member {
  userId: string;
  role: "owner" | TeamRole;
  title: string;
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

function RoleBadge({ role, title }: { role: "owner" | TeamRole; title: string }) {
  const job = jobRole(title);
  const Icon = role === "owner" ? Crown : job ? ROLE_ICON[job.id] : null;
  const access = role === "owner" ? "Full access" : role === "am" ? "Manages clients" : "Assigned projects";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-primary inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-medium">
        {Icon && <Icon className="size-3" aria-hidden />}
        {roleLabel(role, title)}
      </span>
      <span className="text-muted-foreground">{access}</span>
    </span>
  );
}

export function TeamManager({
  members,
  invites,
  canInvite,
  isOwner,
}: {
  members: Member[];
  invites: { id: string; role: TeamRole; title: string; expiresAt: string }[];
  canInvite: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState<JobRoleId>("designer");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ url: string; copied: boolean; role: string } | null>(null);
  const [editing, setEditing] = useState<{ userId: string; title: JobRoleId } | null>(null);

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
      const r = await apiJson<{ link: string }>("/api/team/invites", { body: { title } });
      setLink({ url: r.link, copied: await copyText(r.link), role: jobRole(title)?.label ?? "teammate" });
    });
  }

  function shareWhatsApp(url: string, role: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(`Join our team on Drifty as ${role}: ${url}`)}`, "_blank", "noopener");
  }

  return (
    <div className="space-y-5">
      {canInvite && (
        <section className="lux-card space-y-4 rounded-2xl p-4 sm:p-5" aria-label="Invite a teammate">
          <div className="flex items-center gap-3">
            <IconBadge icon={UserPlus} />
            <div>
              <h2 className="font-semibold">Invite a teammate</h2>
              <p className="text-muted-foreground text-xs">Pick their role. It decides what they can see.</p>
            </div>
          </div>
          <RolePicker name="invite-role" value={title} onChange={setTitle} allowManagers={isOwner} />
          <Button onClick={() => void invite()} disabled={busy !== ""}>
            {busy === "invite" ? "Creating…" : `Create invite link for a ${jobRole(title)?.label ?? "teammate"}`}
          </Button>
          {link && (
            <div className="bg-muted/40 space-y-2 rounded-xl border p-3 text-sm" role="status">
              <p>
                {link.copied ? "Link copied." : "Copy this link."} Send it to your {link.role.toLowerCase()} (works once, for 7 days):
              </p>
              <p className="font-mono text-xs break-all select-all">{link.url}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void copyText(link.url).then((c) => setLink({ ...link, copied: c }))}>
                  Copy
                </Button>
                <Button size="sm" onClick={() => shareWhatsApp(link.url, link.role)}>
                  <MessageCircle className="size-3.5" aria-hidden />
                  Share on WhatsApp
                </Button>
              </div>
            </div>
          )}
          {invites.length > 0 && (
            <ul className="divide-y border-t text-sm">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {roleLabel(i.role, i.title)} link <span className="text-muted-foreground">· until {shortDate(i.expiresAt)}</span>
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

      <section className="bg-card rounded-2xl border" aria-label="Team members">
        <h2 className="border-b p-4 font-semibold">Members ({members.length})</h2>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.userId} className="space-y-3 p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">
                    {m.name} {m.you && <span className="text-muted-foreground font-normal">(you)</span>}
                  </p>
                  <RoleBadge role={m.role} title={m.title} />
                  {m.email && <p className="text-muted-foreground truncate text-xs">{m.email}</p>}
                </div>
                {isOwner && m.role !== "owner" && (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== ""}
                      onClick={() =>
                        setEditing(
                          editing?.userId === m.userId
                            ? null
                            : { userId: m.userId, title: (jobRole(m.title)?.id ?? (m.role === "am" ? "account_manager" : "designer")) as JobRoleId },
                        )
                      }
                    >
                      Change role
                    </Button>
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
                  </div>
                )}
              </div>
              {editing?.userId === m.userId && (
                <div className="bg-muted/30 space-y-3 rounded-xl border p-3">
                  <RolePicker name={`role-${m.userId}`} value={editing.title} onChange={(t) => setEditing({ userId: m.userId, title: t })} allowManagers />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy !== ""}
                      onClick={() =>
                        void act(`role-${m.userId}`, async () => {
                          await apiJson(`/api/team/members/${m.userId}`, { method: "PATCH", body: { title: editing.title } });
                          setEditing(null);
                        })
                      }
                    >
                      {busy === `role-${m.userId}` ? "Saving…" : `Make ${m.name.split(" ")[0]} a ${jobRole(editing.title)?.label ?? "teammate"}`}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {members.length === 1 && <p className="text-muted-foreground border-t p-4 text-xs">Just you so far. Invite a designer, a copywriter or an account manager above.</p>}
      </section>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
