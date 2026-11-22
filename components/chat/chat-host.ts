"use client";
import { BOT_NAME, BOT_USER_ID, MSG } from "@/lib/nexconn/ids";
import { CODE_KICKED, CODE_TOKEN_INVALID, createConnectionKeeper, STATUS, type LinkState } from "./connection";
import { CHANGELIST_TAG, CONFLICT_TAG, defineChangeListElement, defineConflictElement } from "./feedback-cards";
import { defineDriftElement, DRIFT_TAG } from "./drift-card";
import { APPROVAL_CHECK_TAG, defineApprovalCheckElement, defineScopeElement, SCOPE_TAG } from "./round6-cards";

export const VOICE_MENU_ID = "drifty.voice";
export const VOICE_EVENT = "drifty:voice";
const MIC_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="17" x2="12" y2="22"/></svg>',
  );
import {
  CARD_TAG,
  clearLiveMetadata,
  configureCardActions,
  recordLiveMetadata,
  defineDeliverableCardElement,
  defineReceiptElement,
  METADATA_EVENT,
  RECEIPT_TAG,
  type CardActions,
  type MetadataEventDetail,
} from "./deliverable-card-element";

/**
 * Boots Nexconn Chat + ChatUI in the browser, in the documented order:
 * NCEngine.initialize → NCChatUIApplication.initialize → registerCustomMessages
 * → ready() → NCEngine.connect → mount `nc-chat-ui-app-provider` → openChannel.
 * Only one ChatUI app can exist per page, so this is a module singleton.
 */

export interface ChatHostOptions {
  appKey: string;
  container: HTMLElement;
  /** Room to open first. */
  initialChannelId: string;
  cardActions: CardActions;
}

export interface ChatHostHandle {
  /** Switch the open room (e.g. client ↔ internal tab). */
  open(channelId: string): Promise<void>;
  destroy(): Promise<void>;
}

let active: Promise<ChatHostHandle> | null = null;
let users = 0;
let pendingTeardown: ReturnType<typeof setTimeout> | null = null;

/**
 * Gets the shared chat instance (booting it on first use). Pair every call with
 * releaseChat(). React dev mode mounts effects twice, so teardown is deferred and
 * cancelled if someone re-acquires the chat straight away.
 */
export function startChat(opts: ChatHostOptions): Promise<ChatHostHandle> {
  users++;
  if (pendingTeardown) {
    clearTimeout(pendingTeardown);
    pendingTeardown = null;
  }
  if (active) return active;
  active = boot(opts).catch((err) => {
    active = null;
    throw err;
  });
  return active;
}

export function releaseChat() {
  users = Math.max(0, users - 1);
  if (users > 0 || pendingTeardown) return;
  pendingTeardown = setTimeout(() => {
    pendingTeardown = null;
    if (users > 0 || !active) return;
    const current = active;
    active = null;
    void current.then((h) => h.destroy()).catch(() => {});
  }, 300);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The providers mount asynchronously after the root element is attached, and the
 * channel list syncs after connect; opening before that shows an empty history.
 * Uses timers, not requestAnimationFrame, which never fires in background tabs.
 */
async function openWhenReady(open: () => Promise<{ isOk: boolean }>) {
  await sleep(800);
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await open().catch(() => ({ isOk: false }));
    if (res.isOk) return;
    await sleep(400);
  }
}

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

interface Directory {
  users: { userId: string; name: string }[];
  groups: { groupId: string; name: string; memberCount?: number }[];
  members?: { userId: string; name: string }[];
}

/** Names for ChatUI, fetched from our server (which checks access) and cached. */
function createDirectory() {
  const users = new Map<string, string>();
  const groups = new Map<string, { name: string; memberCount: number }>();
  const valid = (ids: string[]) => ids.filter((id) => /^[A-Za-z0-9]{1,64}$/.test(id));
  return {
    // ChatUI rejects entries with an empty id, so only answer for real ids.
    async users(all: string[]) {
      const ids = valid(all);
      const missing = ids.filter((id) => !users.has(id));
      if (missing.length) {
        const d = await postJson<Directory>("/api/chat/directory", { userIds: missing }).catch(() => null);
        d?.users.forEach((u) => users.set(u.userId, u.name));
      }
      return ids.map((userId) => ({ userId, name: users.get(userId) ?? "Member" }));
    },
    async groups(all: string[]) {
      const ids = valid(all);
      const missing = ids.filter((id) => !groups.has(id));
      if (missing.length) {
        const d = await postJson<Directory>("/api/chat/directory", { groupIds: missing }).catch(() => null);
        d?.groups.forEach((g) => groups.set(g.groupId, { name: g.name, memberCount: g.memberCount ?? 0 }));
      }
      return ids.map((groupId) => ({
        groupId,
        name: groups.get(groupId)?.name ?? "Room",
        memberCount: groups.get(groupId)?.memberCount ?? 0,
      }));
    },
    async members(groupId: string) {
      const d = await postJson<Directory>("/api/chat/directory", { membersOf: groupId }).catch(() => null);
      return (d?.members ?? []).map((m) => {
        users.set(m.userId, m.name);
        return { userId: m.userId, nickname: m.name };
      });
    },
  };
}

// ------------------------------------------------------------ connection state for the UI
let linkState: LinkState = "connecting";
const linkListeners = new Set<(s: LinkState) => void>();
let keeper: ReturnType<typeof createConnectionKeeper> | null = null;

/** Subscribe to connection state ("Reconnecting…" indicator). Returns an unsubscribe. */
export function onLinkState(fn: (s: LinkState) => void): () => void {
  linkListeners.add(fn);
  fn(linkState);
  return () => linkListeners.delete(fn);
}
function publish(s: LinkState) {
  linkState = s;
  linkListeners.forEach((fn) => fn(s));
}
/** Reconnect now (e.g. "Use here" after another device took over). */
export function reconnectChat() {
  void keeper?.reconnectNow();
}

const fetchToken = async () => (await postJson<{ token: string }>("/api/nexconn/token")).token;

async function boot(opts: ChatHostOptions): Promise<ChatHostHandle> {
  publish("connecting");
  const token = await fetchToken();
  const chat = await import("@nexconn/chat");
  const { NCChatUIApplication, ChatUIEvents } = await import("@nexconn/chatui");
  const { NCEngine, LogLevel, MessageHandler, GroupChannelIdentifier, ConnectionStatusHandler } = chat;

  NCEngine.initialize({
    appKey: opts.appKey,
    logLevel: process.env.NODE_ENV === "production" ? LogLevel.WARN : LogLevel.DEBUG,
  });

  const dir = createDirectory();
  const app = NCChatUIApplication.initialize({
    language: "en_US",
    hooks: {
      reqUserProfiles: (ids) => dir.users(ids),
      reqGroupProfiles: (ids) => dir.groups(ids),
      reqGroupMembers: (groupId) => dir.members(groupId),
      async reqSystemProfiles(ids) {
        return ids.map((systemId) => ({ systemId, name: "Drifty" }));
      },
    },
  });
  if (!app) throw new Error("Chat UI failed to start");

  configureCardActions(opts.cardActions);
  app.registerCustomMessages([
    {
      messageType: MSG.deliverable,
      isPersisted: true,
      isCounted: true,
      digest: () => "[Deliverable]",
      component: { tagName: CARD_TAG, elementClass: defineDeliverableCardElement() },
    },
    {
      messageType: MSG.changelist,
      isPersisted: true,
      isCounted: true,
      digest: () => "[Change list]",
      component: { tagName: CHANGELIST_TAG, elementClass: defineChangeListElement() },
    },
    {
      messageType: MSG.conflict,
      isPersisted: true,
      isCounted: true,
      digest: () => "[Please choose]",
      component: { tagName: CONFLICT_TAG, elementClass: defineConflictElement() },
    },
    {
      messageType: MSG.drift,
      isPersisted: true,
      isCounted: true,
      digest: () => "[Drift check]",
      component: { tagName: DRIFT_TAG, elementClass: defineDriftElement() },
    },
    {
      messageType: MSG.approvalCheck,
      isPersisted: true,
      isCounted: true,
      digest: () => "[Please confirm]",
      component: { tagName: APPROVAL_CHECK_TAG, elementClass: defineApprovalCheckElement() },
    },
    {
      messageType: MSG.scope,
      isPersisted: true,
      isCounted: true,
      digest: () => "[Scope]",
      component: { tagName: SCOPE_TAG, elementClass: defineScopeElement() },
    },
    {
      messageType: MSG.receipt,
      isPersisted: true,
      isCounted: true,
      digest: () => "[Approved]",
      component: { tagName: RECEIPT_TAG, elementClass: defineReceiptElement() },
    },
  ]);

  // Voice notes (FR-7): ChatUI for Web plays HD voice messages but has no recorder, so we add
  // a mic button to its toolbar (custom InputMenu item, docs chatui-web/chat-ui/editor.md) and
  // record in our own sheet; the server posts the note as a real Nexconn RC:HQVCMsg.
  const menu = app.cloneInputMenu();
  menu.items.push({ id: VOICE_MENU_ID, order: 5, icon: MIC_ICON, hoverIcon: MIC_ICON });
  app.setInputMenu(menu);
  app.addEventListener(ChatUIEvents.INPUT_MENU_ITEM_CLICK, (evt: { data?: { id?: string; channelModel?: { channelIdentifier?: { channelId?: string } } } }) => {
    if (evt.data?.id !== VOICE_MENU_ID) return;
    const channelId = evt.data.channelModel?.channelIdentifier?.channelId;
    if (channelId) window.dispatchEvent(new CustomEvent(VOICE_EVENT, { detail: { channelId } }));
  });
  app.ready();

  // Live card status: server-written metadata → window event → card elements.
  NCEngine.addMessageHandler(
    "drifty-metadata",
    new MessageHandler({
      onMessageMetadataUpdated(e) {
        recordLiveMetadata(e.messageId, e.metadata);
        window.dispatchEvent(
          new CustomEvent<MetadataEventDetail>(METADATA_EVENT, {
            detail: { messageId: e.messageId, metadata: e.metadata },
          }),
        );
      },
    }),
  );

  // Connection keeper: status listener registered BEFORE connect (docs), plus resume handling.
  keeper = createConnectionKeeper({
    engine: {
      connect: (p) => NCEngine.connect(p),
      disconnect: () => NCEngine.disconnect(),
      getConnectionStatus: () => NCEngine.getConnectionStatus(),
    },
    getToken: fetchToken,
    onState: publish,
  });
  NCEngine.addConnectionStatusHandler(
    "drifty-connection",
    new ConnectionStatusHandler({
      onConnectionStatusChanged({ status, code }) {
        keeper?.onStatus(status, code);
      },
    }),
  );

  let result = await NCEngine.connect({ token });
  if (!result.isOk && result.code === CODE_TOKEN_INVALID) {
    result = await NCEngine.connect({ token: await fetchToken() });
  }
  if (!result.isOk && result.code === CODE_KICKED) {
    keeper.onStatus(STATUS.DISCONNECTED, CODE_KICKED);
  } else if (!result.isOk) {
    keeper.dispose();
    keeper = null;
    NCEngine.removeConnectionStatusHandler("drifty-connection");
    throw new Error("We couldn't connect to the chat. Check your connection and try again.");
  } else {
    keeper.markConnected();
  }
  // ChatUI caches profiles in localStorage; make sure the bot always shows its real name.
  app.updateUserProfile({ userId: BOT_USER_ID, name: BOT_NAME });

  const root = document.createElement("nc-chat-ui-app-provider");
  root.style.width = "100%";
  root.style.height = "100%";
  opts.container.replaceChildren(root);
  // Push the room's name first, so the header never shows the raw channel id on a new device.
  const openRoom = async (channelId: string) => {
    const [g] = await dir.groups([channelId]);
    if (g) app.updateGroupProfile(g);
    return app.openChannel(new GroupChannelIdentifier(channelId), false);
  };
  // Don't block start-up on this; the user can always tap the room in the list.
  void openWhenReady(() => openRoom(opts.initialChannelId));

  return {
    async open(channelId) {
      await openRoom(channelId);
    },
    async destroy() {
      keeper?.dispose();
      keeper = null;
      NCEngine.removeConnectionStatusHandler("drifty-connection");
      NCEngine.removeMessageHandler("drifty-metadata");
      configureCardActions(null);
      clearLiveMetadata();
      opts.container.replaceChildren();
      app.destroy();
      await NCEngine.disconnect();
    },
  };
}
