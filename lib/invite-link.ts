/** Pulls the invite token out of a pasted link (or a bare token). */
export function inviteTokenFrom(text: string): string | null {
  const m = /\/join\/([A-Za-z0-9_-]{10,200})/.exec(text) ?? /^\s*([A-Za-z0-9_-]{30,200})\s*$/.exec(text);
  return m ? m[1] : null;
}

