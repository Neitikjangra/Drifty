import { describe, expect, it } from "vitest";
import { hedged } from "@/lib/ai/hedge";

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      rej(Object.assign(new Error("aborted"), { name: "AbortError" }));
    });
  });

describe("hedged model calls", () => {
  it("uses the main model when it answers before the hedge delay", async () => {
    const started: string[] = [];
    const r = await hedged(["main", "backup"], async (m, _i, s) => (started.push(m), await wait(10, s), m), { hedgeMs: 50 });
    expect(r.model).toBe("main");
    expect(started).toEqual(["main"]);
  });

  it("starts the backup after the delay and takes whichever answers first, cancelling the other", async () => {
    let mainAborted = false;
    const t0 = Date.now();
    const r = await hedged(
      ["main", "backup"],
      async (m, _i, s) => {
        if (m === "main") {
          s.addEventListener("abort", () => (mainAborted = true));
          await wait(1000, s);
        } else await wait(20, s);
        return m;
      },
      { hedgeMs: 30 },
    );
    expect(r.model).toBe("backup");
    expect(Date.now() - t0).toBeLessThan(500);
    expect(mainAborted).toBe(true);
  });

  it("a failure starts the next model at once", async () => {
    const t0 = Date.now();
    const failed: string[] = [];
    const r = await hedged(
      ["main", "backup"],
      async (m, _i, s) => {
        if (m === "main") throw Object.assign(new Error("UNAVAILABLE"), { status: 503 });
        await wait(5, s);
        return m;
      },
      { hedgeMs: 5000, onFail: (m) => failed.push(m) },
    );
    expect(r.model).toBe("backup");
    expect(failed).toEqual(["main"]);
    expect(Date.now() - t0).toBeLessThan(500);
  });

  it("rejects with the last error when every model fails", async () => {
    await expect(
      hedged(["a", "b"], async (m) => {
        throw new Error(`fail ${m}`);
      }, { hedgeMs: 5 }),
    ).rejects.toThrow("fail b");
  });
});
