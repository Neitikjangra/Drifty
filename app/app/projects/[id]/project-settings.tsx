"use client";

import { Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { apiJson } from "@/lib/client-fetch";

const EVENT = "drifty:project-settings";
export type SettingsTab = "overview" | "people" | "team" | "brand" | "project";

/** Opens the project's settings panel at a tab (from anywhere on the page). */
export function openProjectSettings(tab: SettingsTab = "overview") {
  window.dispatchEvent(new CustomEvent<SettingsTab>(EVENT, { detail: tab }));
}

export function SettingsButtons({ canManage }: { canManage: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => openProjectSettings("overview")}>
        Overview
      </Button>
      <Button variant="outline" size="sm" onClick={() => openProjectSettings(canManage ? "people" : "brand")} aria-label="Project settings">
        <Settings2 className="size-4" aria-hidden />
        Settings
      </Button>
    </div>
  );
}

/**
 * Everything that isn't chat or deliverables: overview numbers, client people and invites,
 * the team, brand rules and scope, archive/delete. Opens with ?settings=<tab> too.
 */
export function ProjectSettings({ title, tabs }: { title: string; tabs: { id: SettingsTab; label: string; content: React.ReactNode }[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>(tabs[0]?.id ?? "overview");
  const ids = tabs.map((t) => t.id).join(",");
  const urlChecked = useRef(false);
  useEffect(() => {
    const known = ids.split(",") as SettingsTab[];
    const onOpen = (e: Event) => {
      const want = (e as CustomEvent<SettingsTab>).detail;
      setTab(known.includes(want) ? want : (known[0] ?? "overview"));
      setOpen(true);
    };
    window.addEventListener(EVENT, onOpen);
    if (!urlChecked.current) {
      urlChecked.current = true;
      const fromUrl = new URLSearchParams(window.location.search).get("settings") as SettingsTab | null;
      if (fromUrl) onOpen(new CustomEvent(EVENT, { detail: fromUrl }));
    }
    return () => window.removeEventListener(EVENT, onOpen);
  }, [ids]);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title={title} width="sm:max-w-lg">
      <div className="space-y-4">
        <div role="tablist" aria-label="Settings sections" className="bg-muted/50 flex flex-wrap gap-1 rounded-md p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === current?.id}
              onClick={() => setTab(t.id)}
              className={`rounded px-2.5 py-1 text-sm ${t.id === current?.id ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="space-y-4">
          {current?.content}
        </div>
      </div>
    </Sheet>
  );
}

const AREA = "border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2";

/** What's agreed with the client; read by the team (and the scope alert's context). */
export function ScopePanel({ projectId, scope, canEdit }: { projectId: string; scope: string; canEdit: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(scope);
  const [state, setState] = useState<{ busy: boolean; msg: string; error: boolean }>({ busy: false, msg: "", error: false });
  async function save() {
    setState({ busy: true, msg: "", error: false });
    try {
      await apiJson(`/api/projects/${projectId}`, { method: "PATCH", body: { scope: text } });
      setState({ busy: false, msg: "Saved.", error: false });
      router.refresh();
    } catch (err) {
      setState({ busy: false, msg: err instanceof Error ? err.message : "Couldn't save.", error: true });
    }
  }
  return (
    <section className="space-y-2 rounded-lg border p-3" aria-label="Scope">
      <h3 className="text-sm font-semibold">Scope</h3>
      {canEdit ? (
        <>
          <textarea aria-label="What's included" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} className={AREA} placeholder="8 Instagram posts + 2 reels a month" />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void save()} disabled={state.busy || text === scope}>
              {state.busy ? "Saving…" : "Save scope"}
            </Button>
            {state.msg && <span className={`text-xs ${state.error ? "text-red-600" : "text-green-800"}`}>{state.msg}</span>}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-sm whitespace-pre-line">{scope || "No scope written down yet."}</p>
      )}
      <p className="text-muted-foreground text-xs">Revision rounds included per deliverable are under Overview.</p>
    </section>
  );
}

/** Which creatives work on this project (owners and account managers always do). */
export function ProjectTeamPanel({
  projectId,
  creatives,
  onProject,
  managers,
  canEdit,
}: {
  projectId: string;
  creatives: { userId: string; name: string }[];
  onProject: string[];
  managers: { userId: string; name: string; role: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(onProject);
  const [state, setState] = useState<{ busy: boolean; msg: string; error: boolean }>({ busy: false, msg: "", error: false });
  const changed = picked.length !== onProject.length || picked.some((id) => !onProject.includes(id));
  async function save() {
    setState({ busy: true, msg: "", error: false });
    try {
      await apiJson(`/api/projects/${projectId}`, { method: "PATCH", body: { teamIds: picked } });
      setState({ busy: false, msg: "Saved. Their internal room access is updated.", error: false });
      router.refresh();
    } catch (err) {
      setState({ busy: false, msg: err instanceof Error ? err.message : "Couldn't save.", error: true });
    }
  }
  return (
    <section className="space-y-3 rounded-lg border p-3" aria-label="Project team">
      <h3 className="text-sm font-semibold">Team on this project</h3>
      <ul className="space-y-1 text-sm">
        {managers.map((m) => (
          <li key={m.userId} className="text-muted-foreground">
            {m.name} · {m.role} (always in)
          </li>
        ))}
        {creatives.map((c) => (
          <li key={c.userId}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={picked.includes(c.userId)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.userId] : p.filter((x) => x !== c.userId)))}
              />
              {c.name} · Creative
            </label>
          </li>
        ))}
      </ul>
      {!creatives.length && (
        <p className="text-muted-foreground text-xs">
          No creatives in your workspace yet.{" "}
          <a href="/app/team" className="underline">
            Invite your team
          </a>
        </p>
      )}
      {canEdit && creatives.length > 0 && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void save()} disabled={state.busy || !changed}>
            {state.busy ? "Saving…" : "Save team"}
          </Button>
          {state.msg && <span className={`text-xs ${state.error ? "text-red-600" : "text-green-800"}`}>{state.msg}</span>}
        </div>
      )}
    </section>
  );
}

/** Delete for good (only without approvals: the ledger is permanent). */
export function DeleteProject({ projectId, clientName, approvals }: { projectId: string; clientName: string; approvals: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });
  if (approvals > 0) {
    return (
      <p className="text-muted-foreground text-sm">
        This project has {approvals} approval{approvals === 1 ? "" : "s"} in its ledger. The ledger is permanent, so it can&apos;t be deleted: archive it instead.
      </p>
    );
  }
  const matches = confirm.trim().toLowerCase() === clientName.trim().toLowerCase();
  async function run() {
    setState({ busy: true, error: "" });
    try {
      await apiJson(`/api/projects/${projectId}`, { method: "DELETE", body: { confirmName: confirm } });
      router.push("/app");
      router.refresh();
    } catch (err) {
      setState({ busy: false, error: err instanceof Error ? err.message : "Couldn't delete." });
    }
  }
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Deletes both rooms (for everyone, including the client), all chat history, deliverables and files. This can&apos;t be undone.
      </p>
      <label className="block text-xs">
        Type <span className="font-semibold">{clientName}</span> to confirm
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" aria-label="Type the client's name to confirm" />
      </label>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <Button variant="destructive" onClick={() => void run()} disabled={!matches || state.busy}>
        {state.busy ? "Deleting…" : "Delete project"}
      </Button>
    </div>
  );
}
