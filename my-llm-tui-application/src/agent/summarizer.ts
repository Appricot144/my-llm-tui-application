import type { LLMProvider, ToolResultBlockParam, TextBlockParam } from "../providers/types.ts";

// ========================================================
// 定数
// ========================================================

export const SUMMARIZE_THRESHOLD = 3000;
export const MAX_SUMMARY_LENGTH = 1000;
const SUMMARY_MAX_TOKENS = 512;

// ========================================================
// 公開 API
// ========================================================

export interface SummarizeResult {
  results: ToolResultBlockParam[];
  tokenUsage: { inputTokens: number; outputTokens: number };
}

/**
 * ツール実行結果を一括で受け取り、閾値を超えるものだけ LLM で要約する。
 *
 * @param results       handleToolUse が返したツール結果リスト
 * @param toolNames     tool_use_id → ツール名のマップ（要約プロンプトのコンテキスト用）
 * @param provider      LLM プロバイダー
 * @param model         モデル名
 * @param userMessage   元のユーザー依頼（要約の関連度判断に使用）
 * @param threshold     要約を開始する文字数の閾値（デフォルト 3000）
 */
export async function summarizeToolResults(
  results: ToolResultBlockParam[],
  toolNames: Map<string, string>,
  provider: LLMProvider,
  model: string,
  userMessage: string,
  threshold = SUMMARIZE_THRESHOLD,
): Promise<SummarizeResult> {
  const summarized: ToolResultBlockParam[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const result of results) {
    const contentStr = extractContentString(result.content);

    if (contentStr.length < threshold) {
      summarized.push(result);
      continue;
    }

    const toolName = toolNames.get(result.tool_use_id) ?? "unknown";
    const response = await provider.streamMessage(
      {
        model,
        maxTokens: SUMMARY_MAX_TOKENS,
        system: getSummarizationPrompt(toolName, userMessage),
        messages: [{ role: "user", content: contentStr }],
      },
      () => {}
    );

    totalInputTokens += response.usage.inputTokens;
    totalOutputTokens += response.usage.outputTokens;

    const summaryText = extractContentString(
      response.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("")
    );
    // LLM が制限を超えた場合もハードカットで保証する
    const hardCapped = summaryText.slice(0, MAX_SUMMARY_LENGTH);

    summarized.push({ ...result, content: hardCapped });
  }

  return {
    results: summarized,
    tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
  };
}

// ========================================================
// プロンプト生成
// ========================================================

export function getSummarizationPrompt(toolName: string, userMessage: string): string {
  return [
    "あなたはツール実行結果の要約者です。",
    "以下のルールに従い、結果を1000文字以内に要約してください。",
    "",
    "【必ず保持する情報】",
    "- ファイルパス（例: /src/agent/agent.ts）",
    "- 行番号（例: 123行目、L123、1行〜50行、lines 1-50）",
    "- 関数名・変数名・クラス名・型名",
    "- マッチ件数・ヒット件数（例: 5件マッチ）",
    "- エラーメッセージ・例外の内容",
    "",
    "【要約方針】",
    `- ツール種別: ${toolName}`,
    `- タスク文脈: ${userMessage}`,
    "- 上記タスクに関連する情報を優先して残す",
    "- 関係のないコードブロックは省略してよい",
    "- 1000文字を超えないこと",
  ].join("\n");
}

// ========================================================
// 内部ヘルパー
// ========================================================

function extractContentString(content: string | TextBlockParam[] | unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as TextBlockParam[]).map((b) => b.text).join("");
  }
  return String(content);
}
