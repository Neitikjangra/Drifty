"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/client-fetch";

export function JoinForm(props: {
  token: string;
  agencyName: string;
  projectName: string;
  role: "approver" | "reviewer";
  suggestedName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(props.suggestedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name so the team knows who's talking.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { projectId } = await apiJson<{ projectId: string }>(`/api/join/${props.token}`, { body: { name } });
      router.replace(`/room/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5" noValidate>
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">{props.agencyName} invited you to</p>
        <h1 className="text-2xl font-semibold tracking-tight">{props.projectName}</h1>
        <p className="text-muted-foreground text-sm">
          {props.role === "approver"
            ? "You're the approver: you'll review drafts and approve them right in the chat."
            : "Review drafts and share feedback by text or voice note."}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} autoComplete="name" className="h-11 text-base" />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
        {busy ? "Opening your room…" : "Join the room"}
      </Button>
      <p className="text-muted-foreground text-center text-xs">No app or password needed.</p>
    </form>
  );
}
