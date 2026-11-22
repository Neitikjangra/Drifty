/**
 * Hedged model calls (NFR-1: change list within 15 s). Start the first model; if it hasn't
 * answered within `hedgeMs` (or it fails), start the next one too. The first success wins and
 * the others are cancelled. A busy model therefore costs `hedgeMs`, not its full timeout
 * (Gemini won't accept deadlines under 10 s). Pure and unit-tested.
 */
export async function hedged<T>(
  models: string[],
  call: (model: string, index: number, signal: AbortSignal) => Promise<T>,
  opts: { hedgeMs: number; onFail?: (model: string, err: unknown) => void },
): Promise<{ value: T; model: string }> {
  if (!models.length) throw new Error("no models");
  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = [];
    let started = 0;
    let failed = 0;
    let done = false;
    let lastErr: unknown;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      done = true;
      if (timer) clearTimeout(timer);
    };
    const startNext = () => {
      if (done || started >= models.length) return;
      const i = started++;
      const ctrl = new AbortController();
      controllers.push(ctrl);
      if (timer) clearTimeout(timer);
      if (started < models.length) timer = setTimeout(startNext, opts.hedgeMs);
      call(models[i], i, ctrl.signal).then(
        (value) => {
          if (done) return;
          finish();
          controllers.forEach((c, j) => j !== i && c.abort());
          resolve({ value, model: models[i] });
        },
        (err) => {
          if (done) return;
          failed++;
          lastErr = err;
          opts.onFail?.(models[i], err);
          if (failed === models.length) {
            finish();
            reject(err);
          } else if (started === failed) {
            startNext(); // nothing else in flight: don't wait for the timer
          }
        },
      );
    };
    startNext();
    void lastErr;
  });
}
