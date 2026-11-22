import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { insertDeliverable, insertVersion, setVersionCard } from "@/lib/db/deliverables";
import {
  addGuest,
  deleteProject,
  insertProject,
  setProjectChannels,
  upsertProfile,
  workspaceMemberNexconnIds,
} from "@/lib/db/repo";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { postDeliverableCard } from "@/lib/deliverables/cards-server";
import { createInvite } from "@/lib/invite-admin";
import { storeMessage } from "@/lib/messages/store";
import { issueAccessToken, sendGroupMessage } from "@/lib/nexconn/api";
import { BOT_USER_ID, nexconnUserId } from "@/lib/nexconn/ids";
import { addToRoom, createProjectRooms, ensureBot } from "@/lib/nexconn/rooms";
import { BUCKET } from "@/lib/storage";
import { DEMO } from "./content";

/**
 * First-run demo project (Round 5): a real project, wired exactly like one the agency makes,
 * so every step of the demo uses the real flows. It has:
 * - two demo client people (Priya, the approver, and Rahul, a reviewer) with personal links,
 * - a v1 card in the client room,
 * - their conflicting feedback already in the room (logo bigger vs smaller, plus a CTA change).
 * Demo projects don't count towards the Free plan's active clients.
 */
export async function seedDemoProject(opts: { workspaceId: string; createdBy: string; origin: string }): Promise<{ projectId: string }> {
  const project = await insertProject(opts.workspaceId, DEMO.clientName, true);
  try {
    const [clientMembers, internalMembers] = await Promise.all([
      workspaceMemberNexconnIds(opts.workspaceId, ["owner", "am"]),
      workspaceMemberNexconnIds(opts.workspaceId),
    ]);
    const rooms = await createProjectRooms({
      projectId: project.id,
      clientName: DEMO.clientName,
      clientRoomMembers: clientMembers,
      internalRoomMembers: internalMembers,
    });
    await setProjectChannels(project.id, rooms.client, rooms.internal);
    const p = { ...project, client_channel_id: rooms.client, internal_channel_id: rooms.internal };

    // Demo client people, each with their own personal link (so the AM can open the client view).
    const people = [];
    for (const person of DEMO.people) {
      const guestId = randomUUID();
      const profile = { user_id: guestId, display_name: person.name, email: null, nexconn_user_id: nexconnUserId(guestId) };
      await upsertProfile(profile);
      await issueAccessToken(profile.nexconn_user_id, profile.display_name);
      await addGuest(project.id, guestId, person.role);
      await createInvite({
        projectId: project.id,
        emailOrPhone: person.contact,
        name: person.name,
        role: person.role,
        createdBy: opts.createdBy,
        usedBy: guestId,
      });
      people.push({ ...person, guestId, nexconnId: profile.nexconn_user_id });
    }
    await addToRoom(rooms.client, people.map((x) => x.nexconnId));

    // v1 card (the design ships with the app under /public/demo).
    const res = await fetch(new URL(DEMO.v1.image, opts.origin), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error("demo image unavailable");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `${project.id}/${randomUUID()}.png`;
    const up = await supabaseAdmin().storage.from(BUCKET).upload(path, bytes, { contentType: "image/png" });
    if (up.error) throw new Error("demo upload failed");
    const d = await insertDeliverable({ project_id: project.id, title: DEMO.deliverable, due_date: null });
    const v = await insertVersion({
      deliverable_id: d.id,
      number: 1,
      asset_path: path,
      asset_sha256: createHash("sha256").update(bytes).digest("hex"),
      asset_mime: "image/png",
      copy_text: DEMO.v1.copy,
      created_by: opts.createdBy,
    });
    await setVersionCard(v.id, await postDeliverableCard(p, d, v));

    // The clients' feedback, posted as them and stored like the webhook would (works even
    // before the Nexconn webhook is configured).
    // Times come from v1's database timestamp (+1 s each), not this server's clock: Summarise
    // reads messages *after* the version, and a skewed clock would silently drop one.
    const base = new Date(v.created_at).getTime();
    for (const [i, m] of DEMO.feedback.entries()) {
      const who = people.find((x) => x.key === m.from)!;
      const msgId = await sendGroupMessage({
        fromUserId: who.nexconnId,
        channelId: rooms.client,
        messageType: "RC:TxtMsg",
        content: { content: m.text },
      });
      await storeMessage(p, {
        nexconnMsgId: msgId,
        channelId: rooms.client,
        authorId: who.nexconnId,
        kind: "text",
        text: m.text,
        replyToText: null,
        voiceRemoteUrl: null,
        voiceDuration: null,
        sentAt: new Date(base + (i + 1) * 1000).toISOString(),
      });
    }

    await ensureBot();
    await sendGroupMessage({
      fromUserId: BOT_USER_ID,
      channelId: rooms.internal,
      messageType: "RC:TxtMsg",
      content: { content: DEMO.internalWelcome },
    });
    return { projectId: project.id };
  } catch (err) {
    await deleteProject(project.id).catch(() => {});
    throw err;
  }
}

/** The workspace's demo project, if it has one (active or archived). */
export async function findDemoProject(workspaceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("projects").select("id").eq("workspace_id", workspaceId).eq("is_demo", true).limit(1);
  return (data?.[0] as { id: string } | undefined)?.id ?? null;
}
