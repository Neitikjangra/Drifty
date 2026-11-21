import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { extFor, MAX_UPLOAD_BYTES, sniffMime, type AllowedMime } from "@/lib/deliverables/rules";
import { supabaseAdmin } from "@/lib/db/supabase-server";

/** Private bucket created in migration 0003 (20 MB, images + PDF). */
export const BUCKET = "deliverables";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** Uploads go straight from the browser to Storage (Vercel limits request bodies to ~4.5 MB). */
export async function createUploadSlot(projectId: string, mime: AllowedMime) {
  const path = `${projectId}/${randomUUID()}.${extFor(mime)}`;
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new UploadError("Couldn't prepare the upload. Please try again.");
  return { path: data.path, token: data.token };
}

/**
 * Verifies an uploaded object belongs to this project, is within limits and really is an
 * image/PDF (magic bytes), and returns its SHA-256 (stored for the approval ledger).
 */
export async function inspectUpload(projectId: string, path: string): Promise<{ sha256: string; mime: AllowedMime }> {
  if (!new RegExp(`^${projectId}/[0-9a-f-]{36}\\.(png|jpg|webp|gif|pdf)$`).test(path)) {
    throw new UploadError("That upload doesn't belong to this project.");
  }
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(path);
  if (error || !data) throw new UploadError("The upload didn't finish. Please upload the file again.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("Files can be at most 20 MB.");
  const mime = sniffMime(bytes.subarray(0, 16));
  if (!mime) throw new UploadError("That file isn't a valid image or PDF.");
  return { sha256: createHash("sha256").update(bytes).digest("hex"), mime };
}

/** Short-lived read URL for an access-checked viewer. */
export async function signedReadUrl(path: string, seconds = 300): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error || !data) throw new UploadError("Couldn't load the file.");
  return data.signedUrl;
}
