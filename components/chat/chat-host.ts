"use client";
import { BOT_NAME, BOT_USER_ID, MSG } from "@/lib/nexconn/ids";
import { BOT_AVATAR, personAvatar, ROOM_AVATAR } from "./avatars";
import { limeHover, MIC_ICON, MIC_ICON_HOVER } from "./input-icons";
import { CODE_KICKED, CODE_TOKEN_INVALID, createConnectionKeeper, STATUS, type LinkState } from "./connection";
import { CHANGELIST_TAG, CONFLICT_TAG, defineChangeListElement, defineConflictElement } from "./feedback-cards";
import { defineDriftElement, DRIFT_TAG } from "./drift-card";
import { APPROVAL_CHECK_TAG, defineApprovalCheckElement, defineScopeElement, SCOPE_TAG } from "./round6-cards";

export const VOICE_MENU_ID = "drifty.voice";
export const VOICE_EVENT = "drifty:voice";
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
  /** Room names the page already knows, so a room opens without waiting for the directory. */
  knownGroups?: { groupId: string; name: string }[];
}

/** A room message as the Web SDK returns it (docs chatsdk-web/message/get-history). */
export interface HistoryMessage {
  messageId: string;
  senderUserId: string;
  sentTime: number;
  messageType: string;
  content: unknown;
}

export interface ChatHostHandle {
  /** Switch the open room (e.g. client ↔ internal tab). */
  open(channelId: string): Promise<void>;
  /** Recent messages of a group room, newest first (up to `max`), fetched from Nexconn. */
  history(channelId: string, max?: number): Promise<HistoryMessage[]>;
  destroy(): Promise<void>;
}

let active: Promise<ChatHostHandle> | null = null;
let users = 0;
/** ChatUI and the Chat SDK start once per page load; after a teardown they can't start again. */
let bootedThisPage = false;
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
  if (bootedThisPage) {
    // Back/forward or moving to another project inside the app: the chat was torn down and
    // can't restart in this page load, so load the page fresh (sign-in and room are kept).
    window.location.reload();
    return new Promise<ChatHostHandle>(() => {});
  }
  bootedThisPage = true;
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
 * The providers mount asynchronously after the root element is attached, and the channel
 * list syncs after connect; opening before that shows an empty history (see openWanted).
 * Uses timers, not requestAnimationFrame, which never fires in background tabs.
 */

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
      return ids.map((userId) => {
        const name = userId === BOT_USER_ID ? BOT_NAME : (users.get(userId) ?? "Member");
        return { userId, name, avatarUrl: userId === BOT_USER_ID ? BOT_AVATAR : personAvatar(name) };
      });
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
        avatarUrl: ROOM_AVATAR,
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
  // Token and the (large) SDK bundles load in parallel: each one used to wait for the previous.
  const [token, chat, { NCChatUIApplication, ChatUIEvents, ChatUICommand }] = await Promise.all([
    fetchToken(),
    import("@nexconn/chat"),
    import("@nexconn/chatui"),
  ]);
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
        return ids.map((systemId) => ({ systemId, name: "Drifty", avatarUrl: BOT_AVATAR }));
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
  // Brand hover for the built-in buttons too (their default hover artwork is blue).
  const lime = (items: typeof menu.items): typeof menu.items =>
    items.map((it) => ({ ...it, hoverIcon: limeHover(it.icon), ...(it.submenu ? { submenu: lime(it.submenu) } : {}) }));
  menu.items = lime(menu.items);
  menu.items.push({ id: VOICE_MENU_ID, order: 5, icon: MIC_ICON, hoverIcon: MIC_ICON_HOVER });
  // The toolbar labels an item by its id; give the mic a readable name (tooltip, screen readers).
  app.registerLanguagePack("en_US", { [VOICE_MENU_ID]: "Voice note" });
  app.setInputMenu(menu);
  app.addEventListener(ChatUIEvents.INPUT_MENU_ITEM_CLICK, (evt: { data?: { id?: string; channelModel?: { channelIdentifier?: { channelId?: string } } } }) => {
    if (evt.data?.id !== VOICE_MENU_ID) return;
    const channelId = evt.data.channelModel?.channelIdentifier?.channelId;
    if (channelId) window.dispatchEvent(new CustomEvent(VOICE_EVENT, { detail: { channelId } }));
  });
  // Feature switches (docs chatui-web/chat-ui/switch, before ready()):
  // - no delivery/read dots next to sent messages (they read as a stuck loader); sending/failed remain
  // - emoji reactions on messages (desktop and H5 layouts)
  app.setCommandSwitch(ChatUICommand.SHOW_MESSAGE_STATE, false);
  app.setCommandSwitch(ChatUICommand.MESSAGE_REACTION_ENABLED, true);
  // Brand bubbles (docs chatui-web/chat-ui/message-bubble, before ready()): own messages in
  // Drifty lime with near-black text, others in a soft grey.
  const bubbles = app.cloneMessageBubbleConfig();
  bubbles.redius = 18;
  bubbles.backgroundColorForMyself = 0xc8f135;
  bubbles.textColorForMyself = 0x0b0c0e;
  bubbles.backgroundColorForOthers = 0xf1f3ef;
  bubbles.textColorForOthers = 0x0b0c0e;
  app.setMessageBubbleConfig(bubbles);
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
  app.updateUserProfile({ userId: BOT_USER_ID, name: BOT_NAME, avatarUrl: BOT_AVATAR });

  const root = document.createElement("nc-chat-ui-app-provider");
  root.style.width = "100%";
  root.style.height = "100%";
  opts.container.replaceChildren(root);
  // Layout (docs chatui-web/chat-ui/layout): our page has its own room tabs, so hide ChatUI's
  // channel list and its back button. The message area then gets the full width, so the
  // sender's own (right-side) bubbles are no longer pushed out of view. Re-applied after the
  // first room opens, in case the shell finished mounting later.
  const applyLayout = () => {
    app.setChannelBarSwitch(false);
    app.setChannelDetailBackSwitch(false);
  };
  applyLayout();
  const stopFit = fitChatUI(opts.container);
  // Push the room's name first, so the header never shows the raw channel id on a new device.
  const openRoom = async (channelId: string) => {
    const known = opts.knownGroups?.find((k) => k.groupId === channelId);
    if (known) {
      // Name known from the page: open now, fill in the member count when the directory answers.
      app.updateGroupProfile({ groupId: known.groupId, name: known.name, memberCount: 0, avatarUrl: ROOM_AVATAR });
      void dir.groups([channelId]).then(([g]) => g && app.updateGroupProfile(g)).catch(() => {});
    } else {
      const [g] = await dir.groups([channelId]);
      if (g) app.updateGroupProfile(g);
    }
    return app.openChannel(new GroupChannelIdentifier(channelId), false);
  };
  // The room the user wants. A tab tapped while ChatUI is still mounting must win over the
  // delayed first open (and must not fail silently and leave the bare channel list).
  let wanted = opts.initialChannelId;
  let starting = true;
  const openWanted = async (delayMs: number) => {
    await sleep(delayMs);
    for (let attempt = 0; attempt < 8; attempt++) {
      const target = wanted;
      const res = await openRoom(target).catch(() => ({ isOk: false }));
      if (res.isOk) applyLayout();
      if (res.isOk && target === wanted) return;
      if (!res.isOk) await sleep(400);
    }
  };
  // Don't block start-up on this; the user can always tap the room in the list.
  void openWanted(300).finally(() => (starting = false)); // retries cover a ChatUI that is still mounting

  return {
    async history(channelId, max = 200) {
      const query = chat.BaseChannel.createMessagesQuery({
        channelIdentifier: new GroupChannelIdentifier(channelId),
        startTime: Date.now(),
        pageSize: 100,
        isAscending: false,
      });
      const out: HistoryMessage[] = [];
      while (out.length < max && query.hasNext) {
        const page = await query.loadNextPage();
        if (!page.isOk || !page.data) break;
        const list = page.data.data ?? [];
        for (const m of list) {
          out.push({ messageId: m.messageId, senderUserId: m.senderUserId, sentTime: m.sentTime, messageType: m.messageType, content: m.content });
        }
        if (!list.length) break;
      }
      return out.slice(0, max);
    },
    async open(channelId) {
      wanted = channelId;
      if (starting) return; // the start-up loop opens the latest choice
      await openWanted(0);
    },
    async destroy() {
      stopFit();
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

/**
 * Reads a room's recent history through the live chat connection (if one is open), so the
 * server can store messages the webhook missed. Empty when the chat isn't running.
 */
export async function readRoomHistory(channelId: string, max = 200): Promise<HistoryMessage[]> {
  if (!active) return [];
  const handle = await active.catch(() => null);
  if (!handle) return [];
  return handle.history(channelId, max).catch(() => []);
}

/**
 * Layout workaround (Layer 5). ChatUI 26.5's message area has a hard `min-width: 600px`, so in a
 * narrower column (our desktop layout next to the side panels, and phones) the sender's own
 * right-side bubbles were pushed out of view. `setChannelBarSwitch(false)` is documented but
 * didn't hide the duplicate channel list in this version. We add one small stylesheet inside
 * ChatUI's open shadow roots: hide the list (our page has its own room tabs) and let the message
 * area shrink to the column. Selectors only touch ChatUI's layout classes, never messages.
 */
const FIT_CSS = `
.nc-chatui-app-wrapper-left{display:none!important}
.nc-chatui-app-wrapper-right{flex:1 1 auto!important;min-width:0!important;width:100%!important;max-width:100%!important}
.nc-chatui-app-inner{min-width:0!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}
.nc-chatui-msg-bubble-wrapper{max-width:min(78%,560px)!important}
.nc-chatui-msg-bubble p{overflow-wrap:anywhere;word-break:break-word}
`;

function fitChatUI(container: HTMLElement): () => void {
  const patched = new WeakSet<ShadowRoot>();
  const patch = (root: ParentNode) => {
    for (const el of root.querySelectorAll("*")) {
      const sr = (el as HTMLElement).shadowRoot;
      if (!sr) continue;
      if (!patched.has(sr)) {
        const style = document.createElement("style");
        style.dataset.drifty = "fit";
        style.textContent = FIT_CSS;
        sr.appendChild(style);
        patched.add(sr);
      }
      patch(sr);
    }
  };
  patch(container);
  // ChatUI renders lazily (rooms, messages): re-check often at first, then occasionally.
  let ticks = 0;
  const timer = setInterval(() => {
    patch(container);
    if (++ticks === 40) {
      clearInterval(timer);
      slow = setInterval(() => patch(container), 3000);
    }
  }, 250);
  let slow: ReturnType<typeof setInterval> | null = null;
  return () => {
    clearInterval(timer);
    if (slow) clearInterval(slow);
  };
}
