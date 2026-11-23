/**
 * Branded chat avatars, drawn in the browser as SVG data URIs (no network, no names in URLs):
 * people get their initials in lime on near-black, the Drifty AI bot a lime badge, rooms a
 * chat-bubble mark. Passed to ChatUI through the profiles' documented `avatarUrl` field.
 */

const INK = "#0b0c0e";
const LIME = "#c8f135";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const svg = (body: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">${body}</svg>`)}`;

/** Up to two initials ("Priya Sharma" → "PS", "drifty" → "D"); "?" when there are none. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts).map((p) => [...p][0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

export function personAvatar(name: string): string {
  return svg(
    `<circle cx="40" cy="40" r="40" fill="${INK}"/><circle cx="40" cy="40" r="38.5" fill="none" stroke="${LIME}" stroke-opacity="0.45" stroke-width="2"/>` +
      `<text x="40" y="41" text-anchor="middle" dominant-baseline="central" font-family="Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="700" fill="${LIME}">${esc(initials(name))}</text>`,
  );
}

/** Drifty AI: lime disc with a dark spark. */
export const BOT_AVATAR = svg(
  `<circle cx="40" cy="40" r="40" fill="${LIME}"/>` +
    `<path d="M40 18 L45.5 34.5 L62 40 L45.5 45.5 L40 62 L34.5 45.5 L18 40 L34.5 34.5 Z" fill="${INK}"/>`,
);

/** Rooms: near-black disc with a lime chat bubble. */
export const ROOM_AVATAR = svg(
  `<circle cx="40" cy="40" r="40" fill="${INK}"/>` +
    `<path d="M24 28a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H38l-9 8v-8h1a6 6 0 0 1-6-6z" fill="none" stroke="${LIME}" stroke-width="3.5" stroke-linejoin="round"/>`,
);
