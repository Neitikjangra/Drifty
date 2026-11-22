"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/client-fetch";
import { supabaseBrowser } from "@/lib/db/supabase-browser";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from "@/lib/deliverables/rules";

export interface DeliverableRow {
  id: string;
  title: string;
  status: "draft" | "in_review" | "changes_requested" | "approved";
  version: number;
  dueDate: string | null;
  copy: string;
  approval: { version: number; by: string; at: string } | null;
  /** Version drift check for the current (held) version, if any (FR-11). */
  drift: {
    alertId: string;
    state: "checking" | "ready" | "sent" | "back" | "superseded";
    toVersion: number;
    checking: number;
    counts: { done: number; missing: number; reversed: number; needs_check: number } | null;
    sendLabel: string;
  } | null;
}

const LABEL: Record<DeliverableRow["status"], string> = {
  draft: "Held for check",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};
const TONE: Record<DeliverableRow["status"], string> = {
  draft: "bg-air-force-blue-900 text-air-force-blue-200",
  in_review: "bg-beige-400 text-beige-100",
  changes_requested: "bg-red-100 text-red-900",
  approved: "bg-ash-grey-700 text-ash-grey-100",
};

/** Uploads straight to Supabase Storage through a one-time signed slot; returns the storage path. */
async function uploadFile(projectId: string, file: File): Promise<string> {
  if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) throw new Error("Upload an image (PNG, JPG, WebP, GIF) or a PDF.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Files can be at most 20 MB.");
  const slot = await apiJson<{ path: string; token: string }>("/api/uploads", {
    body: { projectId, contentType: file.type, size: file.size },
  });
  const { error } = await supabaseBrowser()
    .storage.from("deliverables")
    .uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type });
  if (error) throw new Error("The upload failed. Check your connection and try again.");
  return slot.path;
}

function FilePicker({ id, onPick, file }: { id: string; onPick: (f: File | null) => void; file: File | null }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Draft file</Label>
      <input
        id={id}
        type="file"
        accept={ALLOWED_MIME.join(",")}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        className="file:bg-muted block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium"
      />
      <p className="text-muted-foreground text-xs">
        {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "Image or PDF, up to 20 MB."}
      </p>
    </div>
  );
}

export function DeliverablesPanel(props: {
  projectId: string;
  /** The client room, so Summarise can sync messages the webhook may have missed. */
  clientChannelId?: string | null;
  canCreate: boolean;
  canUpload: boolean;
  hasApprover: boolean;
  items: DeliverableRow[];
}) {
  const [showNew, setShowNew] = useState(props.items.length === 0);
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Deliverables</h2>
        {props.canCreate && !showNew && (
          <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
            New deliverable
          </Button>
        )}
      </div>
      {props.canCreate && showNew && (
        <NewDeliverableForm projectId={props.projectId} hasApprover={props.hasApprover} onDone={() => setShowNew(false)} canCancel={props.items.length > 0} />
      )}
      {props.items.length === 0 && !props.canCreate && (
        <p className="text-muted-foreground text-sm">No deliverables yet.</p>
      )}
      <ul className="space-y-3">
        {props.items.map((d) => (
          <DeliverableItem key={d.id} item={d} projectId={props.projectId} clientChannelId={props.clientChannelId ?? null} canUpload={props.canUpload} canSummarise={props.canCreate} />
        ))}
      </ul>
    </section>
  );
}

function NewDeliverableForm({
  projectId,
  hasApprover,
  onDone,
  canCancel,
}: {
  projectId: string;
  hasApprover: boolean;
  onDone: () => void;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [copy, setCopy] = useState("");
  const [due, setDue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"" | "uploading" | "posting">("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the deliverable a title.");
    if (!file) return setError("Choose the draft file.");
    setError("");
    try {
      setBusy("uploading");
      const assetPath = await uploadFile(projectId, file);
      setBusy("posting");
      await apiJson("/api/deliverables", { body: { projectId, title, copy, dueDate: due || null, assetPath } });
      formRef.current?.reset();
      setTitle("");
      setCopy("");
      setDue("");
      setFile(null);
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post the deliverable.");
    } finally {
      setBusy("");
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="bg-muted/40 space-y-3 rounded-md border p-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="d-title">Title</Label>
        <Input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Diwali post 1" />
      </div>
      <FilePicker id="d-file" file={file} onPick={setFile} />
      <div className="space-y-1.5">
        <Label htmlFor="d-copy">Caption / copy</Label>
        <textarea
          id="d-copy"
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
          maxLength={5000}
          rows={3}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          placeholder="Light up your Diwali with 20% off…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-due">Due date (optional)</Label>
        <Input id="d-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      {!hasApprover && (
        <p className="text-xs text-beige-100">No approver yet: the client can see the card, but nobody can approve it.</p>
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={busy !== ""}>
          {busy === "uploading" ? "Uploading…" : busy === "posting" ? "Posting card…" : "Post to client room"}
        </Button>
        {canCancel && (
          <Button type="button" variant="ghost" onClick={onDone} disabled={busy !== ""}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** Text, replies and voice notes: the message kinds Summarise reads. */
const FEEDBACK_TYPES = new Set(["RC:TxtMsg", "RC:ReferenceMsg", "RC:HQVCMsg", "RC:VcMsg"]);

/**
 * Safety net for the Nexconn webhook: read the client room's recent history through the chat
 * connection and let the server store anything it hasn't seen. Never blocks Summarise.
 */
async function syncClientRoom(projectId: string, channelId: string | null): Promise<number> {
  if (!channelId) return 0;
  try {
    const { readRoomHistory } = await import("@/components/chat/chat-host");
    const history = (await readRoomHistory(channelId, 200)).filter((m) => FEEDBACK_TYPES.has(m.messageType) && m.senderUserId !== "driftybot");
    if (!history.length) return 0;
    const r = await apiJson<{ stored?: number }>("/api/messages/sync", { body: { projectId, messages: history } });
    return r.stored ?? 0;
  } catch {
    return 0; // The webhook path still works; Summarise goes ahead either way.
  }
}

function DeliverableItem({
  item,
  projectId,
  clientChannelId,
  canUpload,
  canSummarise,
}: {
  item: DeliverableRow;
  projectId: string;
  clientChannelId: string | null;
  canUpload: boolean;
  canSummarise: boolean;
}) {
  const router = useRouter();
  const held = item.status === "draft" && item.drift;
  // While AI-3 runs, refresh every few seconds so the result shows up by itself.
  useEffect(() => {
    if (!(held && item.drift?.state === "checking")) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [held, item.drift?.state, router]);
  const [decision, setDecision] = useState<{ busy: "" | "send" | "back"; error: string }>({ busy: "", error: "" });
  async function decide(action: "send" | "back") {
    if (!item.drift) return;
    setDecision({ busy: action, error: "" });
    try {
      await apiJson(`/api/drift/${item.drift.alertId}`, { body: { action } });
      setDecision({ busy: "", error: "" });
      router.refresh();
    } catch (err) {
      setDecision({ busy: "", error: err instanceof Error ? err.message : "Couldn't save that, try again." });
    }
  }
  const [summary, setSummary] = useState<{ busy: boolean; text: string; error: boolean }>({ busy: false, text: "", error: false });

  async function summarise() {
    setSummary({ busy: true, text: "", error: false });
    const synced = await syncClientRoom(projectId, clientChannelId);
    try {
      const r = await apiJson<{ items: number; conflicts: number; conflictCheck?: string; messages: number }>(`/api/deliverables/${item.id}/summarise`);
      const failed = r.conflictCheck === "failed";
      setSummary({
        busy: false,
        error: failed,
        text:
          `${r.items} change${r.items === 1 ? "" : "s"} suggested from ${r.messages} message${r.messages === 1 ? "" : "s"}` +
          (r.conflicts ? `, ${r.conflicts} conflict${r.conflicts > 1 ? "s" : ""} sent to the approver` : "") +
          `. See the Internal room.` +
          (failed ? " The conflict check didn't run (AI busy): summarise again to check." : "") +
          (synced ? ` (${synced} new message${synced === 1 ? "" : "s"} picked up from the room.)` : ""),
      });
    } catch (err) {
      setSummary({ busy: false, error: true, text: err instanceof Error ? err.message : "Couldn't summarise, try again." });
    }
  }
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState(item.copy);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"" | "uploading" | "posting">("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose the new version's file.");
    setError("");
    try {
      setBusy("uploading");
      const assetPath = await uploadFile(projectId, file);
      setBusy("posting");
      await apiJson(`/api/deliverables/${item.id}/versions`, { body: { copy, assetPath } });
      setOpen(false);
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload the new version.");
    } finally {
      setBusy("");
    }
  }

  return (
    <li className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{item.title}</p>
          <p className="text-muted-foreground text-xs">
            v{item.version}
            {item.dueDate ? ` · due ${new Date(item.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
          </p>
        </div>
        <Badge className={TONE[item.status]} variant="secondary">
          {LABEL[item.status]}
        </Badge>
      </div>
      {item.approval && (
        <p className="text-xs text-ash-grey-200">
          Approved v{item.approval.version} by {item.approval.by},{" "}
          {new Date(item.approval.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
      {item.status === "draft" && item.drift && <DriftStatus drift={item.drift} canDecide={canSummarise} decision={decision} onDecide={decide} />}
      {canSummarise && item.status !== "approved" && item.status !== "draft" && (
        <div className="space-y-1">
          <Button size="sm" onClick={summarise} disabled={summary.busy}>
            {summary.busy ? "Summarising… (up to 15 s)" : "Summarise feedback"}
          </Button>
          {summary.text && (
            <p className={`text-xs ${summary.error ? "text-red-600" : "text-ash-grey-200"}`} role={summary.error ? "alert" : "status"}>
              {summary.text}
            </p>
          )}
        </div>
      )}
      {canUpload && item.status !== "approved" && !open && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Upload v{item.version + 1}
        </Button>
      )}
      {open && (
        <form onSubmit={submit} className="bg-muted/40 space-y-3 rounded-md border p-3" noValidate>
          <FilePicker id={`v-file-${item.id}`} file={file} onPick={setFile} />
          <div className="space-y-1.5">
            <Label htmlFor={`v-copy-${item.id}`}>Caption / copy</Label>
            <textarea
              id={`v-copy-${item.id}`}
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              maxLength={5000}
              rows={3}
              className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1" disabled={busy !== ""}>
              {busy === "uploading" ? "Uploading…" : busy === "posting" ? "Posting…" : `Post v${item.version + 1}`}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy !== ""}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function DriftStatus({
  drift,
  canDecide,
  decision,
  onDecide,
}: {
  drift: NonNullable<DeliverableRow["drift"]>;
  canDecide: boolean;
  decision: { busy: "" | "send" | "back"; error: string };
  onDecide: (a: "send" | "back") => void;
}) {
  if (drift.state === "checking") {
    return (
      <p className="text-muted-foreground text-xs" role="status">
        Checking v{drift.toVersion} against {drift.checking} confirmed change{drift.checking === 1 ? "" : "s"}… The client won&apos;t see it until you decide.
      </p>
    );
  }
  if (drift.state === "back") {
    return <p className="text-xs text-beige-100">Sent back to the creative. Upload v{drift.toVersion + 1} when it&apos;s ready.</p>;
  }
  if (drift.state !== "ready") return null;
  const c = drift.counts;
  const summary = c
    ? [c.done && `${c.done} done`, c.missing && `${c.missing} missing`, c.reversed && `${c.reversed} reversed`, c.needs_check && `${c.needs_check} to check`]
        .filter(Boolean)
        .join(" · ")
    : "";
  return (
    <div className="space-y-2 rounded-md bg-secondary p-2">
      <p className="text-xs">
        <span className="font-medium">Drift check v{drift.toVersion}:</span> {summary}. Details in the Internal room.
      </p>
      {canDecide && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onDecide("send")} disabled={decision.busy !== ""}>
            {decision.busy === "send" ? "Sending…" : drift.sendLabel}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDecide("back")} disabled={decision.busy !== ""}>
            {decision.busy === "back" ? "Sending…" : "Back to creative"}
          </Button>
        </div>
      )}
      {decision.error && (
        <p className="text-xs text-red-600" role="alert">
          {decision.error}
        </p>
      )}
    </div>
  );
}
