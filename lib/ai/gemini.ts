import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { z } from "zod";

/**
 * Gemini 3.8 Flash (gemini-3.8-flash) for AI-1..AI-3 and voice transcription.
 * Structured JSON output, validated with Zod; one retry on a parse/validation failure
 * (PRD section 6). Never logs prompts or message contents.
 *
 * Capacity: one try on the main model (the SDK's own retries are off). If it's overloaded
 * (429/5xx/timeout) it is skipped for 60 s, and AI_FALLBACK_MODEL (off by default) is tried.
 */

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

const env = (k: string) => process.env[k]?.trim().replace(/^"(.*)"$/, "$1") || "";

const clients = new Map<number, GoogleGenAI>();
/** `timeoutMs`: short for text tasks (NFR-1: change list within 15 s), longer for audio. */
function ai(timeoutMs = 25_000) {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new AiError("AI isn't configured.");
  // The SDK's own retries would hide overload for minutes; we handle retries ourselves.
  let c = clients.get(timeoutMs);
  if (!c) {
    // v1beta: where preview models and JSON-schema output are available (v1 returns 404 for them).
    c = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: "v1beta", timeout: timeoutMs, retryOptions: { attempts: 1 } } });
    clients.set(timeoutMs, c);
  }
  return c;
}

/** AI_MODEL first, then AI_FALLBACK_MODEL (comma-separated list allowed, tried in order). */
function models(): string[] {
  const main = env("AI_MODEL") || "gemini-3.8-flash";
  const fallbacks = env("AI_FALLBACK_MODEL").split(",").map((m) => m.trim()).filter(Boolean);
  return [...new Set([main, ...fallbacks])];
}

/** 429 RESOURCE_EXHAUSTED: the API key's quota is used up (not a passing overload). */
export function isQuota(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return e?.status === 429 && /RESOURCE_EXHAUSTED|quota/i.test(e?.message ?? "");
}

/** Busy/unavailable: 429, any 5xx, timeouts and network errors. Bad requests (4xx) are not. */
export function isOverload(err: unknown): boolean {
  const e = err as { status?: number; name?: string; message?: string };
  if (typeof e?.status === "number") return e.status === 429 || e.status >= 500;
  return (
    e?.name === "AbortError" ||
    e?.name === "TimeoutError" ||
    /timed? ?out|UNAVAILABLE|overloaded|high demand|fetch failed|ECONN|socket/i.test(e?.message ?? "")
  );
}

/**
 * One try on the main model; if it's busy, the fallback (when AI_FALLBACK_MODEL is set).
 * Overloaded calls can take ~20 s to fail, so retrying the same model would blow the 15 s target.
 */
const busyUntil = new Map<string, number>();
const BUSY_FOR_MS = 60_000;

/** `hasFallback`: shorter timeout for a model that has a fallback after it, so a busy main model fails fast. */
async function onAvailableModel<T>(task: string, call: (model: string, hasFallback: boolean) => Promise<T>): Promise<T> {
  let last: unknown;
  const list = models();
  for (const [i, model] of list.entries()) {
    // Circuit breaker: skip a model that was busy in the last minute (if there's another to try).
    if (i < list.length - 1 && (busyUntil.get(model) ?? 0) > Date.now()) continue;
    try {
      const out = await call(model, i < list.length - 1);
      busyUntil.delete(model);
      return out;
    } catch (err) {
      last = err;
      if (!isOverload(err)) throw err;
      busyUntil.set(model, Date.now() + BUSY_FOR_MS);
      console.warn(`[ai] ${task} model=${model} busy`);
    }
  }
  throw last instanceof Error ? last : new AiError("AI is busy right now.");
}

/** Structured call: returns parsed+validated JSON or throws AiError after one retry. */
export async function generateJson<S extends z.ZodType>(opts: {
  task: string;
  system: string;
  prompt: string;
  jsonSchema: unknown;
  zod: S;
  thinking: "low" | "medium";
}): Promise<z.infer<S>> {
  const started = Date.now();
  let lastProblem = "";
  let quota = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await onAvailableModel(opts.task, (model, hasFallback) =>
        ai(hasFallback ? 8_000 : 35_000).models.generateContent({
          model,
          contents: opts.prompt,
          config: {
            systemInstruction: opts.system,
            responseMimeType: "application/json",
            responseJsonSchema: opts.jsonSchema,
            thinkingConfig: { thinkingLevel: opts.thinking === "low" ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM },
          },
        }),
      );
      const parsed = opts.zod.safeParse(JSON.parse(res.text ?? ""));
      if (parsed.success) {
        console.info(`[ai] ${opts.task} ok attempt=${attempt} ms=${Date.now() - started}`);
        return parsed.data;
      }
      lastProblem = "schema";
    } catch (err) {
      if (err instanceof AiError && err.message === "AI isn't configured.") throw err;
      lastProblem = err instanceof SyntaxError ? "parse" : isOverload(err) ? "busy" : "api";
      quota = isQuota(err);
      if (lastProblem === "busy") break; // already retried inside onAvailableModel
    }
  }
  console.warn(`[ai] ${opts.task} failed (${lastProblem}) ms=${Date.now() - started}`);
  throw new AiError(
    quota
      ? "The AI's usage limit is used up for now. Couldn't summarise: try again later or ask the workspace owner to raise the Gemini quota."
      : lastProblem === "busy"
        ? "The AI is busy right now. Couldn't summarise, try again in a minute."
        : "Couldn't summarise, try again.",
  );
}

/** Voice note → text (FR-7). Returns "" for silence. */
export async function transcribeAudio(audio: Uint8Array, mimeType: string): Promise<string> {
  const started = Date.now();
  const res = await onAvailableModel("transcribe", (model, hasFallback) =>
    ai(hasFallback ? 20_000 : 45_000).models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: Buffer.from(audio).toString("base64") } },
            {
              text: "Transcribe this client voice note word for word in its original language (Hindi, English or a mix). Return only the transcript. If there is no speech, return an empty string.",
            },
          ],
        },
      ],
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    }),
  );
  console.info(`[ai] transcribe ok ms=${Date.now() - started}`);
  return (res.text ?? "").trim().slice(0, 5000);
}
