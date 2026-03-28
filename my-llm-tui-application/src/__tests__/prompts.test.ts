import { describe, it, expect } from "vitest";
import { getPrompt, type Mode } from "../agent/prompts.ts";

describe("getPrompt", () => {
  it("debug モードでシステムプロンプトを返す", () => {
    const prompt = getPrompt("debug");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("review モードでシステムプロンプトを返す", () => {
    const prompt = getPrompt("review");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("coding モードでシステムプロンプトを返す", () => {
    const prompt = getPrompt("coding");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("各モードで異なるプロンプトを返す", () => {
    const debug = getPrompt("debug");
    const review = getPrompt("review");
    const coding = getPrompt("coding");

    expect(debug).not.toBe(review);
    expect(debug).not.toBe(coding);
    expect(review).not.toBe(coding);
  });

  it("未知のモードでエラーをスローする", () => {
    expect(() => getPrompt("unknown" as Mode)).toThrow();
  });
});
