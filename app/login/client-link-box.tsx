"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteTokenFrom } from "@/lib/invite-link";

/**
 * For clients: the installed iPhone app keeps its own sign-in, separate from Safari, so a
 * client opening it lands here. Pasting the invite link opens their room inside the app.
 */
export function ClientLinkBox() {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  function open(e: React.FormEvent) {
    e.preventDefault();
    const token = inviteTokenFrom(link);
    if (!token) return setError("Paste the whole link your agency sent you.");
    router.push(`/join/${token}`);
  }
  return (
    <form onSubmit={open} className="space-y-2 rounded-2xl border p-4 bg-card" noValidate>
      <Label htmlFor="invite-link" className="font-medium">
        Are you a client?
      </Label>
      <p className="text-muted-foreground text-xs">Paste the invite link your agency sent you to open your room. No account needed.</p>
      <div className="flex gap-2">
        <Input id="invite-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drifty-six.vercel.app/join/…" autoComplete="off" className="h-10" />
        <Button type="submit" variant="outline" className="h-10">
          Open
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
