"use client";

/**
 * Keeps the Nexconn connection alive on flaky phones (FR-7/NFR-2):
 * - the SDK reconnects by itself every 5 s while SUSPENDED;
 * - it STOPS for good on DISCONNECTED with an error code, so we take over:
 *   31004 (token wrong/expired) → fresh token + reconnect; 31010 (same user opened
 *   elsewhere) → tell the user, "Use here" reconnects; anything else → retry with backoff;
 * - phones freeze the page while locked, so on resume (visible / online / pageshow) we
 *   reconnect if we're down, and force a fresh connection after a long sleep because the
 *   socket is usually dead even if the SDK hasn't noticed yet.
 * Docs: chatsdk-web/connection/{connect,listener,reconnect-kick}.md, chatsdk-web/code.md.
 */

export type LinkState = "connecting" | "connected" | "reconnecting" | "offline" | "kicked";

export const STATUS = { CONNECTED: 0, CONNECTING: 1, DISCONNECTED: 2, SUSPENDED: 3 } as const;
export const CODE_TOKEN_INVALID = 31004;
export const CODE_KICKED = 31010;

/** Pure mapping from an SDK status event to what we show and what we do. Unit-tested. */
export function classify(
  status: number,
  code: number | undefined,
  everConnected: boolean,
): { state: LinkState; action: "none" | "refresh-token" | "retry" } {
  if (status === STATUS.CONNECTED) return { state: "connected", action: "none" };
  if (status === STATUS.CONNECTING) return { state: everConnected ? "reconnecting" : "connecting", action: "none" };
  if (status === STATUS.SUSPENDED) return { state: "reconnecting", action: "none" }; // SDK retries itself
  if (code === CODE_KICKED) return { state: "kicked", action: "none" };
  if (code === CODE_TOKEN_INVALID) return { state: "reconnecting", action: "refresh-token" };
  return { state: "reconnecting", action: "retry" };
}

/** A long sleep (screen off) usually kills the socket silently; reconnect fresh after this. */
export const STALE_AFTER_HIDDEN_MS = 30_000;

interface Engine {
  connect(p: { token: string }): Promise<{ isOk: boolean; code: number }>;
  disconnect(): Promise<void>;
  getConnectionStatus(): number;
}

export function createConnectionKeeper(opts: {
  engine: Engine;
  getToken: () => Promise<string>;
  onState: (s: LinkState) => void;
}) {
  const { engine, getToken, onState } = opts;
  let state: LinkState = "connecting";
  let everConnected = false;
  let busy = false;
  let disposed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let hiddenAt: number | null = null;

  const set = (s: LinkState) => {
    if (s === "connected") {
      everConnected = true;
      attempt = 0;
    }
    if (s !== state) {
      state = s;
      onState(s);
    }
  };

  async function reconnect(force: boolean) {
    if (disposed || busy) return;
    busy = true;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    set(navigator.onLine === false ? "offline" : "reconnecting");
    try {
      if (force) await engine.disconnect().catch(() => {});
      const token = await getToken();
      const res = await engine.connect({ token });
      if (res.isOk) set("connected");
      else if (res.code === CODE_KICKED) set("kicked");
      else scheduleRetry();
    } catch {
      scheduleRetry();
    } finally {
      busy = false;
    }
  }

  function scheduleRetry() {
    if (disposed) return;
    set(navigator.onLine === false ? "offline" : "reconnecting");
    const delay = Math.min(30_000, 2_000 * 2 ** attempt++);
    retryTimer = setTimeout(() => void reconnect(false), delay);
  }

  /** Feed every SDK status change here. */
  function onStatus(status: number, code?: number) {
    const { state: next, action } = classify(status, code, everConnected);
    set(next);
    if (action === "refresh-token" || action === "retry") scheduleRetry();
  }

  function onResume() {
    if (disposed || state === "kicked") return;
    const sleptLong = hiddenAt !== null && Date.now() - hiddenAt > STALE_AFTER_HIDDEN_MS;
    hiddenAt = null;
    const s = engine.getConnectionStatus();
    if (s === STATUS.DISCONNECTED || sleptLong) void reconnect(sleptLong && s !== STATUS.DISCONNECTED);
    else if (s === STATUS.CONNECTED) set("connected"); // e.g. back online and the socket survived
    else set("reconnecting"); // CONNECTING / SUSPENDED: the SDK is already on it
  }
  const onVisibility = () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else onResume();
  };
  const onOnline = () => onResume();
  const onOffline = () => set("offline");

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("pageshow", onResume);

  return {
    onStatus,
    markConnected: () => set("connected"),
    /** "Use here" after a kick, or a manual retry. */
    reconnectNow: () => reconnect(true),
    get state() {
      return state;
    },
    dispose() {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pageshow", onResume);
    },
  };
}
