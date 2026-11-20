"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatHostHandle } from "@/components/chat/chat-host";

type SpikeUser = "alice" | "bob";
type Phase =
  | { kind: "pick" }
  | { kind: "connecting"; user: SpikeUser }
  | { kind: "ready"; user: SpikeUser }
  | { kind: "error"; message: string };

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function SpikeClient({ appKey }: { appKey: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ChatHostHandle | null>(null);
  const userRef = useRef<SpikeUser | null>(null);

  useEffect(() => () => void handleRef.current?.destroy(), []);

  async function join(user: SpikeUser) {
    if (!containerRef.current) return;
    userRef.current = user;
    setPhase({ kind: "connecting", user });
    try {
      const session = await postJson<{
        token: string;
        channelId: string;
        users: { userId: string; name: string }[];
      }>("/api/spike/session", { user });
      const { startChat } = await import("@/components/chat/chat-host");
      handleRef.current = await startChat({
        appKey,
        token: session.token,
        container: containerRef.current,
        groupChannelId: session.channelId,
        groupName: "Drifty spike room",
        profiles: [{ userId: "driftybot", name: "Drifty AI" }, ...session.users],
        cardActions: {
          canApprove: () => true,
          approve: async (messageId) => {
            await postJson("/api/spike/approve", { messageId, user: userRef.current });
          },
        },
      });
      setPhase({ kind: "ready", user });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Couldn't connect." });
    }
  }

  async function postCard() {
    setPosting(true);
    setNotice("");
    try {
      await postJson("/api/spike/card");
      setNotice("Card posted. It should appear in both browsers.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't post the card.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mx-auto flex h-dvh max-w-5xl flex-col gap-3 p-3 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Drifty · Round 0 spike</h1>
          <p className="text-muted-foreground text-sm">
            Custom card in Nexconn ChatUI, status updated live through message metadata.
          </p>
        </div>
        {phase.kind === "ready" && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              You are {phase.user === "alice" ? "Alice (agency)" : "Bob (client)"}
            </span>
            <Button onClick={postCard} disabled={posting} size="sm">
              {posting ? "Posting…" : "Post test card"}
            </Button>
          </div>
        )}
      </header>

      {notice && <p className="text-sm" role="status">{notice}</p>}

      {phase.kind === "pick" && (
        <Card className="mx-auto mt-8 w-full max-w-md">
          <CardHeader>
            <CardTitle>Join the test room</CardTitle>
            <CardDescription>
              Open this page in two browsers and pick a different user in each.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => join("alice")}>Join as Alice</Button>
            <Button className="flex-1" variant="outline" onClick={() => join("bob")}>Join as Bob</Button>
          </CardContent>
        </Card>
      )}

      {phase.kind === "connecting" && (
        <p className="text-muted-foreground mt-8 text-center text-sm" role="status">
          Connecting to the chat…
        </p>
      )}

      {phase.kind === "error" && (
        <Card className="mx-auto mt-8 w-full max-w-md border-red-200">
          <CardHeader>
            <CardTitle>Couldn&apos;t open the room</CardTitle>
            <CardDescription>{phase.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => location.reload()}>Try again</Button>
          </CardContent>
        </Card>
      )}

      <div
        ref={containerRef}
        className={phase.kind === "ready" ? "min-h-0 flex-1 overflow-hidden rounded-lg border" : "hidden"}
      />
    </div>
  );
}
