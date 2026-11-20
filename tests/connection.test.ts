import { describe, expect, it } from "vitest";
import { classify, CODE_KICKED, CODE_TOKEN_INVALID, STATUS } from "@/components/chat/connection";

describe("connection status classification", () => {
  it("connected / connecting", () => {
    expect(classify(STATUS.CONNECTED, undefined, false)).toEqual({ state: "connected", action: "none" });
    expect(classify(STATUS.CONNECTING, undefined, false).state).toBe("connecting");
    expect(classify(STATUS.CONNECTING, undefined, true).state).toBe("reconnecting");
  });

  it("suspended: the SDK retries by itself", () => {
    expect(classify(STATUS.SUSPENDED, undefined, true)).toEqual({ state: "reconnecting", action: "none" });
  });

  it("token wrong or expired: fetch a fresh token", () => {
    expect(classify(STATUS.DISCONNECTED, CODE_TOKEN_INVALID, true)).toEqual({ state: "reconnecting", action: "refresh-token" });
  });

  it("opened elsewhere: tell the user, don't fight the other device", () => {
    expect(classify(STATUS.DISCONNECTED, CODE_KICKED, true)).toEqual({ state: "kicked", action: "none" });
  });

  it("any other disconnect: we retry (the SDK has stopped)", () => {
    expect(classify(STATUS.DISCONNECTED, 30002, true)).toEqual({ state: "reconnecting", action: "retry" });
    expect(classify(STATUS.DISCONNECTED, undefined, true).action).toBe("retry");
  });
});
