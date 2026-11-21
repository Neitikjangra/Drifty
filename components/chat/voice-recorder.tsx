"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const MAX_SECONDS = 60; // Nexconn HD voice limit

type Phase = { kind: "closed" } | { kind: "idle" } | { kind: "recording"; started: number } | { kind: "review"; blob: Blob; url: string; seconds: number } | { kind: "sending" } | { kind: "error"; message: string };

function pickMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

/**
 * Voice-note sheet opened from the mic button in ChatUI's toolbar (FR-7). Records up to 60 s,
 * lets you listen back, then posts it to the room through /api/voice.
 */
export function VoiceRecorder({ projectId, eventName }: { projectId: string; eventName: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "closed" });
  const [channelId, setChannelId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    const open = (e: Event) => {
      const id = (e as CustomEvent<{ channelId: string }>).detail?.channelId;
      if (!id) return;
      setChannelId(id);
      setPhase({ kind: "idle" });
    };
    window.addEventListener(eventName, open);
    return () => window.removeEventListener(eventName, open);
  }, [eventName]);

  // Timer + 60 s limit
  useEffect(() => {
    if (phase.kind !== "recording") return;
    const t = setInterval(() => {
      const s = (Date.now() - phase.started) / 1000;
      setNow(s);
      if (s >= MAX_SECONDS) stop();
    }, 200);
    return () => clearInterval(t);
     
  }, [phase]);

  function cleanup() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    rec.current = null;
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return setPhase({ kind: "error", message: "This browser can't record audio. Try Chrome or Safari." });
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const type = (r.mimeType || mime || "audio/webm").split(";")[0];
        const blob = new Blob(chunks.current, { type });
        const seconds = Math.max(1, Math.min(MAX_SECONDS, Math.round((Date.now() - started) / 1000)));
        cleanup();
        setPhase({ kind: "review", blob, url: URL.createObjectURL(blob), seconds });
      };
      const started = Date.now();
      rec.current = r;
      r.start(250);
      setNow(0);
      setPhase({ kind: "recording", started });
    } catch {
      cleanup();
      setPhase({ kind: "error", message: "Microphone access was blocked. Allow the microphone for this site and try again." });
    }
  }

  function stop() {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }

  function close() {
    stop();
    cleanup();
    if (phase.kind === "review") URL.revokeObjectURL(phase.url);
    setPhase({ kind: "closed" });
  }

  async function send() {
    if (phase.kind !== "review" || !channelId) return;
    const { blob, seconds, url } = phase;
    setPhase({ kind: "sending" });
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("channelId", channelId);
    fd.set("duration", String(seconds));
    fd.set("file", new File([blob], `voice.${ext}`, { type: blob.type }));
    try {
      const res = await fetch("/api/voice", { method: "POST", body: fd });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Couldn't send the voice note.");
      }
      URL.revokeObjectURL(url);
      setPhase({ kind: "closed" });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Couldn't send the voice note." });
    }
  }

  if (phase.kind === "closed") return null;
  const secs = Math.floor(now);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center" role="dialog" aria-label="Record a voice note" onClick={close}>
      <div className="bg-background w-full max-w-sm space-y-4 rounded-xl p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Voice note</h2>
          <button className="text-muted-foreground text-sm" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        {phase.kind === "idle" && (
          <>
            <p className="text-muted-foreground text-sm">Up to 60 seconds. Hindi, English or both: Drifty transcribes it for the team.</p>
            <Button className="h-12 w-full text-base" onClick={start}>
              ● Start recording
            </Button>
          </>
        )}
        {phase.kind === "recording" && (
          <>
            <div className="flex items-center gap-2" role="status">
              <span className="inline-block size-3 animate-pulse rounded-full bg-red-600" aria-hidden />
              <span className="font-mono text-lg tabular-nums">
                0:{String(secs).padStart(2, "0")} / 1:00
              </span>
            </div>
            <Button className="h-12 w-full text-base" onClick={stop}>
              ■ Stop
            </Button>
          </>
        )}
        {phase.kind === "review" && (
          <>
            <audio src={phase.url} controls className="w-full" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase({ kind: "idle" })}>
                Re-record
              </Button>
              <Button className="flex-1" onClick={send}>
                Send
              </Button>
            </div>
          </>
        )}
        {phase.kind === "sending" && (
          <p className="text-muted-foreground text-sm" role="status">
            Sending…
          </p>
        )}
        {phase.kind === "error" && (
          <>
            <p className="text-sm text-red-600" role="alert">
              {phase.message}
            </p>
            <Button variant="outline" className="w-full" onClick={() => setPhase({ kind: "idle" })}>
              Try again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
