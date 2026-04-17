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

  it("chat モードでシステムプロンプトを返す", () => {
    const prompt = getPrompt("chat");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("chat モードのプロンプトにツール関連の指示が含まれない", () => {
    const prompt = getPrompt("chat");
    expect(prompt).not.toContain("list_directory");
    expect(prompt).not.toContain("read_file");
    expect(prompt).not.toContain("search_code");
    expect(prompt).not.toContain("ツール");
  });

  it("非 chat モードのプロンプトに条件付きツール使用の指示が含まれる", () => {
    for (const mode of ["debug", "review", "coding"] as const) {
      const prompt = getPrompt(mode);
      expect(prompt).toContain("必要な場合のみ");
    }
  });

  it("非 chat モードのプロンプトに並列ツール呼び出しの指示が含まれる", () => {
    for (const mode of ["debug", "review", "coding"] as const) {
      const prompt = getPrompt(mode);
      expect(prompt).toContain("複数の tool_use をまとめて返してよい");
    }
  });

  it("非 chat モードのプロンプトに範囲指定読み込みの指示が含まれる", () => {
    for (const mode of ["debug", "review", "coding"] as const) {
      const prompt = getPrompt(mode);
      expect(prompt).toContain("start_line");
      expect(prompt).toContain("end_line");
    }
  });

  it("各モードで異なるプロンプトを返す", () => {
    const chat = getPrompt("chat");
    const debug = getPrompt("debug");
    const review = getPrompt("review");
    const coding = getPrompt("coding");

    expect(chat).not.toBe(debug);
    expect(chat).not.toBe(review);
    expect(chat).not.toBe(coding);
    expect(debug).not.toBe(review);
    expect(debug).not.toBe(coding);
    expect(review).not.toBe(coding);
  });

  it("未知のモードでエラーをスローする", () => {
    expect(() => getPrompt("unknown" as Mode)).toThrow();
  });
});
