"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/client-fetch";

type State = "loading" | "hidden" | "ios-install" | "denied" | "off" | "on" | "busy";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/**
 * Bell button that turns push notifications on/off for this browser. Hidden where the browser
 * can't do push; on iPhone it explains that Drifty must be added to the Home Screen first.
 */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let next: State;
      if (!PUBLIC_KEY) next = "hidden";
      else if (!supported) next = isIos() && !isStandalone() ? "ios-install" : "hidden";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        next = sub && Notification.permission === "granted" ? "on" : "off";
        // This browser may have been turned on while someone else was signed in here (an agency
        // login, then the client's link): re-link it to whoever is signed in now.
        if (sub && next === "on") await apiJson("/api/push/subscribe", { body: sub.toJSON() }).catch(() => {});
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("hidden"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setState("busy");
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
      await apiJson("/api/push/subscribe", { body: sub.toJSON() });
      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn on notifications.");
      setState("off");
    }
  }

  async function turnOff() {
    setState("busy");
    setError("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiJson("/api/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("Couldn't turn off notifications.");
      setState("on");
    }
  }

  if (state === "loading" || state === "hidden") return null;
  const cls = "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline disabled:opacity-60";
  if (state === "ios-install") {
    return <span className="text-muted-foreground text-xs">For alerts: Share → Add to Home Screen</span>;
  }
  if (state === "denied") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs" title="Allow notifications for this site in your browser settings">
        <BellOff className="size-3.5" aria-hidden /> Alerts blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      {state === "on" ? (
        <button type="button" className={cls} onClick={() => void turnOff()} aria-pressed aria-label="Notifications on. Turn off" title="Turn off notifications on this device">
          <Bell className="size-4 fill-current" aria-hidden />
          {!compact && <span>Alerts on</span>}
        </button>
      ) : (
        <button type="button" className={cls} onClick={() => void turnOn()} disabled={state === "busy"} aria-pressed={false} title="Get notified on this device">
          <Bell className="size-4" aria-hidden />
          <span>{state === "busy" ? "…" : compact ? "Alerts" : "Turn on alerts"}</span>
        </button>
      )}
      {error && (
        <span className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
