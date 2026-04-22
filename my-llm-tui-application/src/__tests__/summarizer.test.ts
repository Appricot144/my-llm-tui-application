import { describe, it, expect, vi } from "vitest";
import type { LLMProvider, ToolResultBlockParam } from "../providers/types.ts";
import {
  summarizeToolResults,
  getSummarizationPrompt,
  SUMMARIZE_THRESHOLD,
  MAX_SUMMARY_LENGTH,
} from "../agent/summarizer.ts";

// ========================================================
// テストヘルパー
// ========================================================

function makeProvider(summaryText: string, inputTokens = 30, outputTokens = 60): LLMProvider {
  return {
    supportsTools: true,
    streamMessage: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: summaryText }],
      stopReason: "end_turn",
      usage: { inputTokens, outputTokens },
    }),
  } as unknown as LLMProvider;
}

function makeResult(id: string, content: string): ToolResultBlockParam {
  return { type: "tool_result", tool_use_id: id, content };
}

function makeToolNames(pairs: [string, string][]): Map<string, string> {
  return new Map(pairs);
}

// ========================================================
// summarizeToolResults
// ========================================================

describe("summarizeToolResults", () => {
  it("閾値未満の結果はそのまま返すこと", async () => {
    const shortContent = "a".repeat(SUMMARIZE_THRESHOLD - 1);
    const results = [makeResult("id1", shortContent)];
    const provider = makeProvider("要約結果");

    const { results: out } = await summarizeToolResults(
      results, makeToolNames([["id1", "read_file"]]), provider, "claude-sonnet-4", "テスト"
    );

    expect(out[0]!.content).toBe(shortContent);
    expect(provider.streamMessage).not.toHaveBeenCalled();
  });

  it("閾値以上の結果は LLM で要約すること", async () => {
    const longContent = "x".repeat(SUMMARIZE_THRESHOLD);
    const results = [makeResult("id1", longContent)];
    const provider = makeProvider("要約されたテキスト");

    const { results: out } = await summarizeToolResults(
      results, makeToolNames([["id1", "read_file"]]), provider, "claude-sonnet-4", "テスト"
    );

    expect(provider.streamMessage).toHaveBeenCalledOnce();
    expect(out[0]!.content).toBe("要約されたテキスト");
  });

  it("LLM の出力が MAX_SUMMARY_LENGTH を超えた場合はハードカットすること", async () => {
    const longContent = "x".repeat(SUMMARIZE_THRESHOLD);
    const oversizedSummary = "A".repeat(MAX_SUMMARY_LENGTH + 500);
    const results = [makeResult("id1", longContent)];
    const provider = makeProvider(oversizedSummary);

    const { results: out } = await summarizeToolResults(
      results, makeToolNames([["id1", "read_file"]]), provider, "claude-sonnet-4", "テスト"
    );

    expect((out[0]!.content as string).length).toBe(MAX_SUMMARY_LENGTH);
  });

  it("tokenUsage を正しく集計すること", async () => {
    const longContent = "x".repeat(SUMMARIZE_THRESHOLD);
    const results = [
      makeResult("id1", longContent),
      makeResult("id2", longContent),
    ];
    const provider = makeProvider("要約", 50, 100);

    const { tokenUsage } = await summarizeToolResults(
      results,
      makeToolNames([["id1", "read_file"], ["id2", "search_code"]]),
      provider, "claude-sonnet-4", "テスト"
    );

    expect(tokenUsage.inputTokens).toBe(100);
    expect(tokenUsage.outputTokens).toBe(200);
  });

  it("閾値未満の結果が混在する場合、閾値以上のものだけ要約すること", async () => {
    const shortContent = "短い結果";
    const longContent = "x".repeat(SUMMARIZE_THRESHOLD);
    const results = [
      makeResult("id1", shortContent),
      makeResult("id2", longContent),
    ];
    const provider = makeProvider("要約済み");

    const { results: out } = await summarizeToolResults(
      results,
      makeToolNames([["id1", "list_directory"], ["id2", "read_file"]]),
      provider, "claude-sonnet-4", "テスト"
    );

    expect(provider.streamMessage).toHaveBeenCalledOnce();
    expect(out[0]!.content).toBe(shortContent);
    expect(out[1]!.content).toBe("要約済み");
  });

  it("ツール名が不明な場合は 'unknown' としてプロンプトを生成すること", async () => {
    const longContent = "x".repeat(SUMMARIZE_THRESHOLD);
    const results = [makeResult("id_unknown", longContent)];
    const provider = makeProvider("要約");

    await summarizeToolResults(
      results, makeToolNames([]), provider, "claude-sonnet-4", "テスト"
    );

    const [params] = (provider.streamMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [Record<string, unknown>];
    expect(params["system"]).toContain("unknown");
  });

  it("tools を渡さずに streamMessage を呼ぶこと", async () => {
    const longContent = "x".repeat(SUMMARIZE_THRESHOLD);
    const results = [makeResult("id1", longContent)];
    const provider = makeProvider("要約");

    await summarizeToolResults(
      results, makeToolNames([["id1", "read_file"]]), provider, "claude-sonnet-4", "テスト"
    );

    const [params] = (provider.streamMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [Record<string, unknown>];
    expect(params).not.toHaveProperty("tools");
  });

  it("TextBlockParam[] 形式のコンテンツも正しく処理すること", async () => {
    const longText = "x".repeat(SUMMARIZE_THRESHOLD);
    const results: ToolResultBlockParam[] = [{
      type: "tool_result",
      tool_use_id: "id1",
      content: [{ type: "text", text: longText }],
    }];
    const provider = makeProvider("要約済み");

    const { results: out } = await summarizeToolResults(
      results, makeToolNames([["id1", "read_file"]]), provider, "claude-sonnet-4", "テスト"
    );

    expect(provider.streamMessage).toHaveBeenCalledOnce();
    expect(out[0]!.content).toBe("要約済み");
  });
});

// ========================================================
// getSummarizationPrompt
// ========================================================

describe("getSummarizationPrompt", () => {
  it("ツール名をプロンプトに含めること", () => {
    const prompt = getSummarizationPrompt("read_file", "バグを修正してください");
    expect(prompt).toContain("read_file");
  });

  it("ユーザー依頼をプロンプトに含めること", () => {
    const prompt = getSummarizationPrompt("search_code", "バグを修正してください");
    expect(prompt).toContain("バグを修正してください");
  });

  it("行番号の保持を指示すること", () => {
    const prompt = getSummarizationPrompt("read_file", "テスト");
    expect(prompt).toContain("行番号");
  });

  it("ファイルパスの保持を指示すること", () => {
    const prompt = getSummarizationPrompt("read_file", "テスト");
    expect(prompt).toContain("ファイルパス");
  });
});
