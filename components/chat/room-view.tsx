"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatHostHandle } from "./chat-host";
import type { LinkState } from "./connection";

/** Slim connection banner; hidden while connected. */
function LinkBar({ state }: { state: LinkState }) {
  if (state === "connected") return null;
  if (state === "kicked") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900" role="status">
        <span>This room is open on another device or tab, so new messages go there.</span>
        <button
          className="shrink-0 font-semibold underline underline-offset-2"
          onClick={() => void import("./chat-host").then((h) => h.reconnectChat())}
        >
          Use here
        </button>
      </div>
    );
  }
  const text = state === "offline" ? "You're offline. Messages will arrive when you're back online." : state === "connecting" ? "Connecting…" : "Reconnecting…";
  return (
    <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md px-3 py-1.5 text-xs" role="status" aria-live="polite">
      <span className="inline-block size-2 animate-pulse rounded-full bg-amber-500" aria-hidden />
      {text}
    </div>
  );
}

export interface RoomTab {
  channelId: string;
  label: string;
  hint?: string;
}

type Phase = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

/**
 * Hosts Nexconn ChatUI for one or more rooms. With several rooms (agency view) it
 * shows tabs; a client sees only their single client room.
 */
export function RoomView({ appKey, rooms, className }: { appKey: string; rooms: RoomTab[]; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ChatHostHandle | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [activeId, setActiveId] = useState(rooms[0]?.channelId);
  const [attempt, setAttempt] = useState(0);
  const initial = rooms[0]?.channelId;

  useEffect(() => {
    let cancelled = false;
    let acquired = false;
    let release: (() => void) | null = null;
    (async () => {
      if (!containerRef.current || !initial) return;
      try {
        const host = await import("./chat-host");
        if (cancelled) return;
        release = host.releaseChat;
        acquired = true;
        const handle = await host.startChat({
          appKey,
          container: containerRef.current,
          initialChannelId: initial,
          // Deliverable actions arrive in Round 2.
          cardActions: { canApprove: () => false, approve: async () => {} },
        });
        if (cancelled) return;
        handleRef.current = handle;
        setPhase({ kind: "ready" });
      } catch (err) {
        if (!cancelled) setPhase({ kind: "error", message: err instanceof Error ? err.message : "Couldn't open the chat." });
      }
    })();
    return () => {
      cancelled = true;
      handleRef.current = null;
      if (acquired) release?.();
    };
  }, [appKey, initial, attempt]);

  async function switchTo(channelId: string) {
    setActiveId(channelId);
    await handleRef.current?.open(channelId).catch(() => {});
  }

  // Connection indicator ("Reconnecting…").
  const [link, setLink] = useState<LinkState>("connecting");
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    void import("./chat-host").then((h) => {
      if (!cancelled) unsub = h.onLinkState(setLink);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const active = rooms.find((r) => r.channelId === activeId);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col gap-2", className)}>
      {rooms.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Rooms">
          {rooms.map((r) => (
            <button
              key={r.channelId}
              role="tab"
              aria-selected={r.channelId === activeId}
              onClick={() => void switchTo(r.channelId)}
              disabled={phase.kind !== "ready"}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors disabled:opacity-50",
                r.channelId === activeId ? "bg-foreground text-background border-foreground" : "hover:bg-muted",
              )}
            >
              {r.label}
            </button>
          ))}
          {active?.hint && <span className="text-muted-foreground text-xs">{active.hint}</span>}
        </div>
      )}

      {phase.kind === "ready" && <LinkBar state={link} />}

      {phase.kind === "loading" && (
        <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border text-sm" role="status">
          Opening the room…
        </div>
      )}
      {phase.kind === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center" role="alert">
          <p className="text-sm">{phase.message}</p>
          <Button
            size="sm"
            onClick={() => {
              setPhase({ kind: "loading" });
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn("min-h-0 flex-1 overflow-hidden rounded-lg border", phase.kind !== "ready" && "hidden")}
      />
    </div>
  );
}
