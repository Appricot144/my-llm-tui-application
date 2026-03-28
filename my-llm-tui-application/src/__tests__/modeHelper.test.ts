import { describe, it, expect } from "vitest";
import { nextMode, MODE_LABELS } from "../utils/modeHelper.ts";

describe("nextMode", () => {
  it("chat の次は coding", () => {
    expect(nextMode("chat")).toBe("coding");
  });

  it("coding の次は debug", () => {
    expect(nextMode("coding")).toBe("debug");
  });

  it("debug の次は review", () => {
    expect(nextMode("debug")).toBe("review");
  });

  it("review の次は chat に戻る", () => {
    expect(nextMode("review")).toBe("chat");
  });

  it("全モードを順にサイクルできる", () => {
    let mode = nextMode("chat");
    expect(mode).toBe("coding");
    mode = nextMode(mode);
    expect(mode).toBe("debug");
    mode = nextMode(mode);
    expect(mode).toBe("review");
    mode = nextMode(mode);
    expect(mode).toBe("chat");
  });
});

describe("MODE_LABELS", () => {
  it("全モードにラベルが定義されている", () => {
    expect(MODE_LABELS["chat"]).toBeDefined();
    expect(MODE_LABELS["coding"]).toBeDefined();
    expect(MODE_LABELS["debug"]).toBeDefined();
    expect(MODE_LABELS["review"]).toBeDefined();
  });
});
