"use client";
import { MSG } from "@/lib/nexconn/ids";
import {
  CARD_TAG,
  clearLiveMetadata,
  configureCardActions,
  recordLiveMetadata,
  defineDeliverableCardElement,
  METADATA_EVENT,
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
  token: string;
  container: HTMLElement;
  groupChannelId: string;
  profiles: { userId: string; name: string }[];
  groupName: string;
  cardActions: CardActions;
}

export interface ChatHostHandle {
  destroy(): Promise<void>;
}

let active: Promise<ChatHostHandle> | null = null;

export function startChat(opts: ChatHostOptions): Promise<ChatHostHandle> {
  if (active) return active;
  active = boot(opts).catch((err) => {
    active = null;
    throw err;
  });
  return active;
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

async function boot(opts: ChatHostOptions): Promise<ChatHostHandle> {
  const chat = await import("@nexconn/chat");
  const { NCChatUIApplication } = await import("@nexconn/chatui");
  const { NCEngine, LogLevel, MessageHandler, GroupChannelIdentifier } = chat;

  NCEngine.initialize({
    appKey: opts.appKey,
    // Debug during integration (skill rule); switch to WARN before production.
    logLevel: process.env.NODE_ENV === "production" ? LogLevel.WARN : LogLevel.DEBUG,
  });

  const names = new Map(opts.profiles.map((p) => [p.userId, p.name]));
  const app = NCChatUIApplication.initialize({
    language: "en_US",
    hooks: {
      async reqUserProfiles(ids) {
        return ids.map((userId) => ({ userId, name: names.get(userId) ?? "Member" }));
      },
      async reqGroupProfiles(ids) {
        return ids.map((groupId) => ({ groupId, name: opts.groupName, memberCount: opts.profiles.length }));
      },
      async reqGroupMembers() {
        return opts.profiles.map((p) => ({ userId: p.userId, nickname: p.name }));
      },
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
  ]);
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

  const result = await NCEngine.connect({ token: opts.token });
  if (!result.isOk) throw new Error(`Chat connection failed (code ${result.code})`);

  const root = document.createElement("nc-chat-ui-app-provider");
  root.style.width = "100%";
  root.style.height = "100%";
  opts.container.replaceChildren(root);
  // Don't block start-up on this; the user can always tap the room in the list.
  void openWhenReady(() => app.openChannel(new GroupChannelIdentifier(opts.groupChannelId), false));

  return {
    async destroy() {
      NCEngine.removeMessageHandler("drifty-metadata");
      configureCardActions(null);
      clearLiveMetadata();
      opts.container.replaceChildren();
      app.destroy();
      await NCEngine.disconnect();
      active = null;
    },
  };
}
