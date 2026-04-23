import { describe, it, expect, vi } from "vitest";
import { buildCacheKey, buildSystemParam, run } from "../agent/agent.ts";
import type { LLMProvider } from "../providers/types.ts";

describe("buildCacheKey", () => {
  describe("read_file", () => {
    it("path のみ指定した場合のキーを返す", () => {
      const key = buildCacheKey("read_file", { path: "src/index.ts" });
      expect(key).toBe("read_file:src/index.ts::");
    });

    it("start_line / end_line を含むキーを返す", () => {
      const key = buildCacheKey("read_file", { path: "src/index.ts", start_line: 10, end_line: 50 });
      expect(key).toBe("read_file:src/index.ts:10:50");
    });

    it("start_line のみ指定した場合は end_line を空文字にする", () => {
      const key = buildCacheKey("read_file", { path: "src/index.ts", start_line: 5 });
      expect(key).toBe("read_file:src/index.ts:5:");
    });

    it("同じ引数には同じキーを返す", () => {
      const a = buildCacheKey("read_file", { path: "foo.ts", start_line: 1, end_line: 100 });
      const b = buildCacheKey("read_file", { path: "foo.ts", start_line: 1, end_line: 100 });
      expect(a).toBe(b);
    });

    it("異なるパスには異なるキーを返す", () => {
      const a = buildCacheKey("read_file", { path: "a.ts" });
      const b = buildCacheKey("read_file", { path: "b.ts" });
      expect(a).not.toBe(b);
    });

    it("異なる行範囲には異なるキーを返す", () => {
      const a = buildCacheKey("read_file", { path: "foo.ts", start_line: 1, end_line: 50 });
      const b = buildCacheKey("read_file", { path: "foo.ts", start_line: 51, end_line: 100 });
      expect(a).not.toBe(b);
    });
  });

  describe("list_directory", () => {
    it("path 指定時のキーを返す", () => {
      const key = buildCacheKey("list_directory", { path: "src" });
      expect(key).toBe("list_directory:src");
    });

    it("path 省略時は '.' をデフォルトにする", () => {
      const key = buildCacheKey("list_directory", {});
      expect(key).toBe("list_directory:.");
    });
  });

  describe("search_code", () => {
    it("pattern と path を含むキーを返す", () => {
      const key = buildCacheKey("search_code", { pattern: "function foo", path: "src" });
      expect(key).toBe("search_code:function foo:src");
    });

    it("path 省略時は '.' をデフォルトにする", () => {
      const key = buildCacheKey("search_code", { pattern: "TODO" });
      expect(key).toBe("search_code:TODO:.");
    });

    it("異なるパターンには異なるキーを返す", () => {
      const a = buildCacheKey("search_code", { pattern: "foo" });
      const b = buildCacheKey("search_code", { pattern: "bar" });
      expect(a).not.toBe(b);
    });
  });

  describe("書き込みツール", () => {
    it("write_file は null を返す", () => {
      expect(buildCacheKey("write_file", { path: "out.ts", content: "x" })).toBeNull();
    });

    it("edit_file は null を返す", () => {
      expect(buildCacheKey("edit_file", { path: "out.ts", start_line: 1, end_line: 1, new_content: "x" })).toBeNull();
    });

    it("create_directory は null を返す", () => {
      expect(buildCacheKey("create_directory", { path: "dir" })).toBeNull();
    });

    it("未知のツール名は null を返す", () => {
      expect(buildCacheKey("unknown_tool", {})).toBeNull();
    });
  });
});

// ========================================================
// buildSystemParam のテスト
// ========================================================

describe("buildSystemParam", () => {
  it("projectContext なしは base 文字列をそのまま返すこと", () => {
    const result = buildSystemParam("basePrompt", undefined, false);
    expect(result).toBe("basePrompt");
  });

  it("projectContext あり・supportsPromptCaching=false は結合文字列を返すこと", () => {
    const result = buildSystemParam("base", "context", false);
    expect(result).toBe("base\n\n[プロジェクト概要]\ncontext");
  });

  it("projectContext あり・supportsPromptCaching=true は2ブロック配列を返すこと", () => {
    const result = buildSystemParam("base", "context", true);
    expect(Array.isArray(result)).toBe(true);
    const blocks = result as Array<Record<string, unknown>>;
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: "text", text: "base" });
    expect(blocks[1]).toEqual({
      type: "text",
      text: "[プロジェクト概要]\ncontext",
      cache_control: { type: "ephemeral" },
    });
  });

  it("projectContext なし・supportsPromptCaching=true でも文字列を返すこと", () => {
    const result = buildSystemParam("base", undefined, true);
    expect(result).toBe("base");
  });
});

// ========================================================
// planning スキップ動作のテスト
// ========================================================

function makeRunProvider(responses: { text: string }[]): LLMProvider {
  const mock = vi.fn();
  for (const r of responses) {
    mock.mockResolvedValueOnce({
      content: [{ type: "text", text: r.text }],
      stopReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 20 },
    });
  }
  return {
    supportsTools: true,
    supportsPromptCaching: false,
    streamMessage: mock,
  } as unknown as LLMProvider;
}

const RUN_BASE = {
  model: "claude-sonnet-4",
  conversationHistory: [],
  projectRoot: "/tmp",
  mode: "coding",
} as const;

describe("planning スキップ", () => {
  it("番号付きリスト入力は planning コールをスキップすること", async () => {
    const provider = makeRunProvider([{ text: "完了しました" }]);

    await run({
      ...RUN_BASE,
      provider,
      userMessage: "1. foo.ts を修正\n2. bar.ts を修正",
    });

    // planning なし → streamMessage は本体の1回のみ
    expect(provider.streamMessage).toHaveBeenCalledTimes(1);
  });

  it("通常の依頼文は planning コールを行うこと", async () => {
    const planJson = JSON.stringify({
      tasks: [{ title: "実行", detail: "処理する" }],
    });
    const provider = makeRunProvider([
      { text: planJson },
      { text: "完了しました" },
    ]);

    await run({
      ...RUN_BASE,
      provider,
      userMessage: "新機能を追加してください",
    });

    // planning + 本体 → 2回
    expect(provider.streamMessage).toHaveBeenCalledTimes(2);
  });

  it("planning が空タスクを返した場合 onPlanGenerated が呼ばれないこと", async () => {
    const provider = makeRunProvider([
      { text: '{"tasks":[]}' },
      { text: "完了しました" },
    ]);
    const onPlanGenerated = vi.fn();

    await run({
      ...RUN_BASE,
      provider,
      userMessage: "ファイルを修正してください",
      onPlanGenerated,
    });

    expect(onPlanGenerated).not.toHaveBeenCalled();
  });

  it("planning が空タスクを返した場合もシステムプロンプトに実行計画が注入されないこと", async () => {
    const provider = makeRunProvider([
      { text: '{"tasks":[]}' },
      { text: "完了しました" },
    ]);

    await run({
      ...RUN_BASE,
      provider,
      userMessage: "ファイルを修正してください",
    });

    const [secondCallParams] = (provider.streamMessage as ReturnType<typeof vi.fn>).mock.calls[1] as [
      Record<string, unknown>,
    ];
    expect(secondCallParams["system"]).not.toContain("[実行計画]");
  });
});
