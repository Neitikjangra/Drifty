/**
 * Drifty's own glyph: a chat bubble whose tail sweeps into a tick. Scattered feedback in,
 * an approved result out, drawn as one stroke. Uses currentColor so it fits any badge.
 */
export function DriftGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      {/* bubble */}
      <path
        d="M20 11.2c0 4.3-3.7 7.6-8.2 7.6-1.1 0-2.2-.2-3.2-.6L4 19.6l1.3-3.6C4.5 14.6 4 13 4 11.2 4 6.9 7.6 3.6 12 3.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the drift: a swoosh closing the bubble that lands as a tick */}
      <path d="M8.6 11.4l2.4 2.4 8.6-8.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* spark */}
      <circle cx="20.2" cy="3.4" r="1.3" fill="currentColor" />
    </svg>
  );
}
