/**
 * Input toolbar icons. ChatUI draws each toolbar button as a 30×30 image whose artwork includes
 * the tile (a #F3F5FA square, 8 px corners) and a thin dark glyph; its hover artwork is blue.
 * Our mic follows the same spec so it lines up, and every hover becomes Drifty lime instead.
 */

export const TILE = "#F3F5FA";
export const TILE_HOVER = "#E8F8B0"; // lime tint
const GLYPH = "#020814";

const uri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Lucide "mic" glyph scaled into the 30×30 tile (≈14 px tall, stroke ≈1.15 px like the built-ins). */
function micSvg(tile: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30" fill="none">` +
    `<rect width="30" height="30" rx="8" fill="${tile}"/>` +
    `<g transform="translate(7.8 7.8) scale(0.6)" stroke="${GLYPH}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>` +
    `</g></svg>`
  );
}

export const MIC_ICON = uri(micSvg(TILE));
export const MIC_ICON_HOVER = uri(micSvg(TILE_HOVER));

/** Reads an SVG data URI (url-encoded or base64); null for anything else. */
export function decodeSvgDataUri(src: string): string | null {
  const m = /^data:image\/svg\+xml(;[^,]*)?,([\s\S]*)$/.exec(src);
  if (!m) return null;
  try {
    return m[1]?.includes("base64") ? atob(m[2]) : decodeURIComponent(m[2]);
  } catch {
    return null;
  }
}

/**
 * The lime hover version of a built-in toolbar icon: its normal artwork with the tile tinted
 * lime. Falls back to the normal icon (no blue hover) when the artwork can't be read.
 */
export function limeHover(icon: string): string {
  const svg = decodeSvgDataUri(icon);
  if (!svg || !svg.includes(TILE)) return icon;
  return uri(svg.split(TILE).join(TILE_HOVER));
}
