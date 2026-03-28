import { describe, it, expect } from "vitest";
import {
  createTokenUsage,
  addTokenUsage,
  formatTokenUsage,
  type TokenUsage,
} from "../utils/tokenUsage.ts";

describe("createTokenUsage", () => {
  it("ゼロ初期化された TokenUsage を返す", () => {
    const usage = createTokenUsage();
    expect(usage.inputTokens).toBe(0);
    expect(usage.outputTokens).toBe(0);
  });
});

describe("addTokenUsage", () => {
  it("トークン数を加算する", () => {
    const base = createTokenUsage();
    const result = addTokenUsage(base, { input_tokens: 100, output_tokens: 50 });
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
  });

  it("複数回加算を累積する", () => {
    let usage = createTokenUsage();
    usage = addTokenUsage(usage, { input_tokens: 100, output_tokens: 50 });
    usage = addTokenUsage(usage, { input_tokens: 200, output_tokens: 80 });
    expect(usage.inputTokens).toBe(300);
    expect(usage.outputTokens).toBe(130);
  });

  it("元のオブジェクトを変更しない", () => {
    const base = createTokenUsage();
    const result = addTokenUsage(base, { input_tokens: 100, output_tokens: 50 });
    expect(base.inputTokens).toBe(0);
    expect(result.inputTokens).toBe(100);
  });
});

describe("formatTokenUsage", () => {
  it("トークン数をフォーマットする", () => {
    const usage: TokenUsage = { inputTokens: 1234, outputTokens: 567 };
    const formatted = formatTokenUsage(usage);
    expect(formatted).toContain("1,234");
    expect(formatted).toContain("567");
  });

  it("ゼロの場合も表示する", () => {
    const usage = createTokenUsage();
    const formatted = formatTokenUsage(usage);
    expect(formatted).toContain("0");
  });

  it("合計トークン数を含む", () => {
    const usage: TokenUsage = { inputTokens: 1000, outputTokens: 500 };
    const formatted = formatTokenUsage(usage);
    expect(formatted).toContain("1,500");
  });
});
