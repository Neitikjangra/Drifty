"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/client-fetch";

export function OnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(email.split("@")[0] ?? "");
  const [workspaceName, setWorkspaceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !workspaceName.trim()) {
      setError("Fill in both fields.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiJson("/api/onboarding", { body: { displayName, workspaceName } });
      router.replace("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Set up your workspace</CardTitle>
        <CardDescription>One workspace for your agency. You&apos;ll be its owner.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Your name</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64} autoComplete="name" />
            <p className="text-muted-foreground text-xs">Clients see this name in their room.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="workspaceName">Agency or workspace name</Label>
            <Input
              id="workspaceName"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Pixel & Co"
              autoComplete="organization"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Setting up…" : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
