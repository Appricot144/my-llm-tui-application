import { describe, it, expect, vi } from "vitest";
import type { LLMProvider } from "../providers/types.ts";
import { planTasks, parsePlan, needsPlanning } from "../agent/planner.ts";

// ========================================================
// モックプロバイダーヘルパー
// ========================================================

function makeProvider(responseText: string, inputTokens = 50, outputTokens = 80): LLMProvider {
  return {
    supportsTools: true,
    supportsPromptCaching: false,
    streamMessage: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: responseText }],
      stopReason: "end_turn",
      usage: { inputTokens, outputTokens },
    }),
  } as unknown as LLMProvider;
}

// ========================================================
// planTasks のテスト
// ========================================================

describe("planTasks", () => {
  it("正常なJSON応答からタスクリストをパースすること", async () => {
    const json = JSON.stringify({
      tasks: [
        { title: "ファイル確認", detail: "src/index.ts を確認する" },
        { title: "実装", detail: "新機能を追加する" },
      ],
    });
    const provider = makeProvider(json);
    const { plan } = await planTasks(provider, "claude-sonnet-4", "新機能を追加してください");

    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[0]).toEqual({ title: "ファイル確認", detail: "src/index.ts を確認する" });
    expect(plan.tasks[1]).toEqual({ title: "実装", detail: "新機能を追加する" });
  });

  it("tokenUsage を正しく返すこと", async () => {
    const json = JSON.stringify({ tasks: [{ title: "実行", detail: "処理する" }] });
    const provider = makeProvider(json, 100, 200);
    const { tokenUsage } = await planTasks(provider, "claude-sonnet-4", "テスト");

    expect(tokenUsage.inputTokens).toBe(100);
    expect(tokenUsage.outputTokens).toBe(200);
  });

  it("JSONパース失敗時はフォールバックの単一タスクを返すこと", async () => {
    const provider = makeProvider("これはJSONではありません");
    const { plan } = await planTasks(provider, "claude-sonnet-4", "ユーザーの依頼");

    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0]!.title).toBe("タスク実行");
    expect(plan.tasks[0]!.detail).toBe("ユーザーの依頼");
  });

  it('LLMが {"tasks":[]} を返した場合は空のタスクリストを返すこと', async () => {
    const provider = makeProvider('{"tasks":[]}');
    const { plan } = await planTasks(provider, "claude-sonnet-4", "テスト");

    expect(plan.tasks).toHaveLength(0);
  });

  it("tools を渡さずに streamMessage を呼ぶこと", async () => {
    const json = JSON.stringify({ tasks: [{ title: "実行", detail: "処理する" }] });
    const provider = makeProvider(json);
    await planTasks(provider, "claude-sonnet-4", "テスト");

    const [params] = (provider.streamMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [Record<string, unknown>];
    expect(params).not.toHaveProperty("tools");
  });

  it("maxTokens が 512 で呼ばれること", async () => {
    const json = JSON.stringify({ tasks: [{ title: "実行", detail: "処理する" }] });
    const provider = makeProvider(json);
    await planTasks(provider, "claude-sonnet-4", "テスト");

    expect(provider.streamMessage).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 512 }),
      expect.any(Function)
    );
  });

  it("会話履歴なし・ユーザーメッセージのみで呼ばれること", async () => {
    const json = JSON.stringify({ tasks: [{ title: "実行", detail: "処理する" }] });
    const provider = makeProvider(json);
    await planTasks(provider, "claude-sonnet-4", "フィーチャー追加");

    expect(provider.streamMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "フィーチャー追加" }],
      }),
      expect.any(Function)
    );
  });
});

// ========================================================
// parsePlan のテスト
// ========================================================

describe("parsePlan", () => {
  it("正常なJSONをパースすること", () => {
    const json = JSON.stringify({
      tasks: [{ title: "確認", detail: "ファイルを確認する" }],
    });
    const plan = parsePlan(json, "テスト依頼");
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0]!.title).toBe("確認");
  });

  it("```json コードブロック内のJSONをパースすること", () => {
    const text = '```json\n{"tasks":[{"title":"実行","detail":"処理する"}]}\n```';
    const plan = parsePlan(text, "テスト依頼");
    expect(plan.tasks[0]!.title).toBe("実行");
  });

  it("前後にテキストがあってもJSONを抽出すること", () => {
    const text = '了解しました。\n{"tasks":[{"title":"実行","detail":"処理する"}]}\n以上です。';
    const plan = parsePlan(text, "テスト依頼");
    expect(plan.tasks[0]!.title).toBe("実行");
  });

  it("tasks が配列でない場合はフォールバックを返すこと", () => {
    const plan = parsePlan('{"tasks":"invalid"}', "フォールバック依頼");
    expect(plan.tasks[0]!.detail).toBe("フォールバック依頼");
  });

  it("タスクの title が文字列でない場合はフォールバックを返すこと", () => {
    const plan = parsePlan('{"tasks":[{"title":123,"detail":"OK"}]}', "フォールバック依頼");
    expect(plan.tasks[0]!.detail).toBe("フォールバック依頼");
  });

  it("空文字列はフォールバックを返すこと", () => {
    const plan = parsePlan("", "フォールバック依頼");
    expect(plan.tasks[0]!.detail).toBe("フォールバック依頼");
  });

  it('{"tasks":[]} は空のタスクリストとして有効なプランを返すこと', () => {
    const plan = parsePlan('{"tasks":[]}', "テスト依頼");
    expect(plan.tasks).toHaveLength(0);
  });
});

// ========================================================
// needsPlanning のテスト
// ========================================================

describe("needsPlanning", () => {
  it("通常の依頼文は true を返すこと", () => {
    expect(needsPlanning("ファイルを修正してください")).toBe(true);
  });

  it("番号付きリスト2行以上は false を返すこと", () => {
    expect(needsPlanning("1. src/foo.ts を修正\n2. テストを実行")).toBe(false);
  });

  it("閉じ括弧形式の番号付きリスト2行以上は false を返すこと", () => {
    expect(needsPlanning("1) foo.ts を変更\n2) bar.ts を変更")).toBe(false);
  });

  it("箇条書き2行以上は false を返すこと", () => {
    expect(needsPlanning("- foo.ts を変更\n- bar.ts を変更")).toBe(false);
  });

  it("アスタリスク箇条書き2行以上は false を返すこと", () => {
    expect(needsPlanning("* foo.ts を変更\n* bar.ts を変更")).toBe(false);
  });

  it("番号付きリストが1行だけなら true を返すこと", () => {
    expect(needsPlanning("1. ファイルを修正する")).toBe(true);
  });

  it("箇条書きが1行だけなら true を返すこと", () => {
    expect(needsPlanning("- ファイルを修正する")).toBe(true);
  });

  it("番号なし複数行テキストは true を返すこと", () => {
    expect(needsPlanning("バグを修正してください。\nエラーメッセージは〇〇です。")).toBe(true);
  });
});
