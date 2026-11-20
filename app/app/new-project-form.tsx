"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/client-fetch";

export function NewProjectForm({ hasProjects }: { hasProjects: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter the client or campaign name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { id } = await apiJson<{ id: string }>("/api/projects", { body: { clientName: name } });
      router.push(`/app/projects/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the project.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-end" noValidate>
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="clientName">{hasProjects ? "New project" : "Create your first project"}</Label>
        <Input
          id="clientName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          placeholder="Client or campaign, e.g. Diwali campaign"
        />
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Creating rooms…" : "Create project"}
      </Button>
    </form>
  );
}
