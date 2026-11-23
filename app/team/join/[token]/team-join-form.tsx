"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/client-fetch";

export function TeamJoinForm({ token, suggestedName }: { token: string; suggestedName: string }) {
  const router = useRouter();
  const [name, setName] = useState(suggestedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name so your team knows who's who.");
    setBusy(true);
    setError("");
    try {
      await apiJson(`/api/team/join/${token}`, { body: { name } });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join. Please try again.");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="team-name">Your name</Label>
        <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} autoComplete="name" className="h-11 text-base" />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
        {busy ? "Joining…" : "Join the team"}
      </Button>
    </form>
  );
}
