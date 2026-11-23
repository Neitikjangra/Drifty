"use client";

import { MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { apiJson } from "@/lib/client-fetch";

const AREA = "border-input bg-muted/60 focus-visible:ring-ring w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2";

export interface Teammate {
  userId: string;
  name: string;
}

/** "New project" button that opens a compact form: client, scope, client contact, team, brand rules. */
export function NewProjectForm({ hasProjects, creatives }: { hasProjects: boolean; creatives: Teammate[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {hasProjects ? "New project" : "Create your first project"}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="New project" description="One project = one client: a client room, an internal room and their deliverables.">
        <ProjectForm creatives={creatives} onCancel={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function ProjectForm({ creatives, onCancel }: { creatives: Teammate[]; onCancel: () => void }) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [scope, setScope] = useState("");
  const [rounds, setRounds] = useState("2");
  const [contactName, setContactName] = useState("");
  const [contactReach, setContactReach] = useState("");
  const [team, setTeam] = useState<string[]>([]);
  const [brandRules, setBrandRules] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ id: string; inviteLink: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) return setError("Enter the client's name.");
    const n = Number(rounds);
    if (!Number.isInteger(n) || n < 1 || n > 20) return setError("Rounds included: a number from 1 to 20.");
    if (Boolean(contactName.trim()) !== Boolean(contactReach.trim())) return setError("For the client contact, add both a name and a phone or email (or leave both empty).");
    setBusy(true);
    setError("");
    try {
      const r = await apiJson<{ id: string; inviteLink: string | null }>("/api/projects", {
        body: {
          clientName,
          scope: scope || undefined,
          roundsIncluded: n,
          brandRules: brandRules || undefined,
          teamIds: team,
          contact: contactName.trim() ? { name: contactName, emailOrPhone: contactReach } : undefined,
        },
      });
      if (r.inviteLink) {
        setDone(r);
        setBusy(false);
      } else {
        router.push(`/app/projects/${r.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the project.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4" role="status">
        <p className="font-medium">{clientName} is ready.</p>
        <div className="bg-muted/40 space-y-2 rounded-xl border p-3 text-sm">
          <p>
            Send {contactName.trim()} their personal link. They open it on their phone, with no app or password, and they&apos;re the approver.
          </p>
          <p className="font-mono text-xs break-all select-all">{done.inviteLink}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(done.inviteLink ?? "")
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false))
              }
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button
              size="sm"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Your ${clientName} room on Drifty: ${done.inviteLink}`)}`, "_blank", "noopener")}
            >
              <MessageCircle className="size-3.5" aria-hidden />
              Share on WhatsApp
            </Button>
          </div>
        </div>
        <Link href={`/app/projects/${done.id}`} className={buttonVariants({ className: "w-full" })}>
          Open the project
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="np-client">Client *</Label>
        <Input id="np-client" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={64} placeholder="Sunrise Cafe" autoFocus />
        <p className="text-muted-foreground text-xs">Names the client room and the internal room.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Scope</legend>
        <textarea aria-label="What's included" value={scope} onChange={(e) => setScope(e.target.value)} maxLength={1000} rows={2} className={AREA} placeholder="8 Instagram posts + 2 reels a month" />
        <div className="flex items-center gap-2 text-sm">
          <Label htmlFor="np-rounds" className="font-normal">
            Revision rounds included per deliverable
          </Label>
          <Input id="np-rounds" type="number" min={1} max={20} value={rounds} onChange={(e) => setRounds(e.target.value)} className="h-8 w-16" />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Client contact (optional)</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input aria-label="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={64} placeholder="Priya (approver)" />
          <Input aria-label="Contact phone or email" value={contactReach} onChange={(e) => setContactReach(e.target.value)} maxLength={120} placeholder="Phone or email" />
        </div>
        <p className="text-muted-foreground text-xs">Gets a personal link and becomes the approver. You can add more people later in Settings.</p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Team</legend>
        {creatives.length ? (
          <ul className="space-y-1">
            {creatives.map((c) => (
              <li key={c.userId}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={team.includes(c.userId)}
                    onChange={(e) => setTeam((t) => (e.target.checked ? [...t, c.userId] : t.filter((x) => x !== c.userId)))}
                  />
                  {c.name}
                </label>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Owners and account managers are always in. {creatives.length ? "Tick the creatives working on this client." : "No creatives yet: "}
          {!creatives.length && (
            <Link href="/app/team" className="underline">
              invite your team
            </Link>
          )}
        </p>
      </fieldset>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Brand rules (optional)</summary>
        <textarea
          aria-label="Brand rules"
          value={brandRules}
          onChange={(e) => setBrandRules(e.target.value)}
          maxLength={4000}
          rows={4}
          className={`${AREA} mt-2`}
          placeholder={"Logo top-left, at least 15% wide\nColours: deep green and cream\nNever say 'cheap'"}
        />
        <p className="text-muted-foreground mt-1 text-xs">The pre-flight check compares every draft with these.</p>
      </details>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? "Creating rooms…" : "Create project"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
