"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/client-fetch";

const AGENCY_SESSION = "signed in as an agency user";

/** Shown when this browser is signed in to an agency account: sign out here, then open the room. */
function AgencySignOut({ token }: { token: string }) {
  return (
    <form method="post" action={`/auth/signout?next=${encodeURIComponent(`/join/${token}`)}`} className="space-y-2">
      <Button type="submit" className="h-11 w-full text-base">
        Sign out of the agency account and open the room
      </Button>
      <p className="text-muted-foreground text-xs">Or open this link in a private window to stay signed in.</p>
    </form>
  );
}

export function JoinForm(props: {
  token: string;
  agencyName: string;
  projectName: string;
  role: "approver" | "reviewer";
  suggestedName: string;
  /** Set when this personal link was used before: go straight into the room. */
  returningName: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(props.suggestedName);
  const [busy, setBusy] = useState(Boolean(props.returningName));
  const [error, setError] = useState("");
  const started = useRef(false);

  async function join(withName?: string) {
    setBusy(true);
    setError("");
    try {
      const { projectId } = await apiJson<{ projectId: string }>(`/api/join/${props.token}`, {
        body: withName ? { name: withName } : {},
      });
      router.replace(`/room/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the room. Please try again.");
      setBusy(false);
    }
  }

  // Returning visitor (any device): no form, straight into the room.
  useEffect(() => {
    if (props.returningName && !started.current) {
      started.current = true;
      void join();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.returningName]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name so the team knows who's talking.");
      return;
    }
    void join(name);
  }

  if (props.returningName) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center" role="status">
        <p className="text-muted-foreground text-sm">{props.agencyName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {props.returningName}</h1>
        {error ? (
          <>
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
            {error.includes(AGENCY_SESSION) ? (
              <AgencySignOut token={props.token} />
            ) : (
              <Button className="h-11 w-full text-base" onClick={() => void join()} disabled={busy}>
                Try again
              </Button>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Opening {props.projectName}…</p>
        )}
      </div>
    );
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
      {error.includes(AGENCY_SESSION) ? (
        <AgencySignOut token={props.token} />
      ) : (
        <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
          {busy ? "Opening your room…" : "Join the room"}
        </Button>
      )}
      <p className="text-muted-foreground text-center text-xs">
        No app or password needed. Keep this link: it&apos;s yours and opens the room on any device.
      </p>
    </form>
  );
}
