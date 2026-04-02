/**
 * agent.ts — エージェントループ
 *
 * LLM が "もう十分" と判断するまで tool_use → dispatch → 結果追加 を繰り返す。
 * ストリーミング対応で、テキスト生成をリアルタイムにコールバックで通知する。
 */

import Anthropic from "@anthropic-ai/sdk";
import { TOOL_SCHEMAS, dispatch, setRoot } from "../tools/tools.ts";
import { getPrompt, type Mode } from "./prompts.ts";
import { createTokenUsage, addTokenUsage, type TokenUsage } from "../utils/tokenUsage.ts";
import type { LLMProvider, NormalizedContentBlock } from "../providers/types.ts";

// ========================================================
// 定数
// ========================================================

const MAX_ITERATIONS = 20;
const MAX_TOKENS = 4096;

// ========================================================
// 型定義
// ========================================================

export interface RunOptions {
  /** 使用するLLMプロバイダー */
  provider: LLMProvider;
  /** 使用するモデル名 */
  model: string;
  /** 今回のユーザーメッセージ */
  userMessage: string;
  /** これまでの会話履歴（API形式） */
  conversationHistory: Anthropic.Messages.MessageParam[];
  /** 読み込みを許可するルートディレクトリ */
  projectRoot: string;
  /** エージェントのモード */
  mode?: Mode;
  /** テキスト生成時のコールバック（ストリーミング用） */
  onTextDelta?: (fullText: string) => void;
  /** ツール呼び出し時のコールバック（UI表示用） */
  onToolUse?: (toolName: string, toolInput: Record<string, unknown>) => void;
}

export interface RunResult {
  /** 最終的な LLM の回答テキスト */
  text: string;
  /** エージェントループ中の全メッセージ（履歴更新用） */
  newMessages: Anthropic.Messages.MessageParam[];
  /** 今回のリクエスト全体のトークン使用量（ループ全イテレーション累計） */
  tokenUsage: TokenUsage;
}

// ========================================================
// エージェント本体
// ========================================================

export async function run({
  provider,
  model,
  userMessage,
  conversationHistory,
  projectRoot,
  mode = "coding",
  onTextDelta,
  onToolUse,
}: RunOptions): Promise<RunResult> {
  const useTools = mode !== "chat" && provider.supportsTools;
  if (useTools) {
    setRoot(projectRoot);
  }

  const systemPrompt = getPrompt(mode);

  // エージェントループ中に追加されるメッセージ
  const newMessages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // API に渡す全メッセージ = 過去の履歴 + 今回の新規メッセージ
  const allMessages = (): Anthropic.Messages.MessageParam[] => [
    ...conversationHistory,
    ...newMessages,
  ];

  let tokenUsage = createTokenUsage();

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await provider.streamMessage(
      {
        model,
        maxTokens: MAX_TOKENS,
        system: systemPrompt,
        messages: allMessages(),
        tools: useTools ? (TOOL_SCHEMAS as unknown as Parameters<typeof provider.streamMessage>[0]["tools"]) : undefined,
      },
      (fullText) => {
        onTextDelta?.(fullText);
      }
    );

    tokenUsage = addTokenUsage(tokenUsage, {
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
    });

    // アシスタントの返答を履歴に追加
    newMessages.push({
      role: "assistant",
      content: response.content as unknown as Anthropic.Messages.ContentBlockParam[],
    });

    if (response.stopReason === "end_turn" || response.stopReason === "max_tokens") {
      return {
        text: extractText(response.content),
        newMessages,
        tokenUsage,
      };
    }

    if (response.stopReason === "tool_use") {
      const toolResults = handleToolUse(response.content, onToolUse);
      newMessages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return {
    text: "エラー: 最大反復回数に達しました",
    newMessages,
    tokenUsage,
  };
}

// ========================================================
// 内部ヘルパー
// ========================================================

function handleToolUse(
  contentBlocks: NormalizedContentBlock[],
  onToolUse?: (toolName: string, toolInput: Record<string, unknown>) => void,
): Anthropic.Messages.ToolResultBlockParam[] {
  const results: Anthropic.Messages.ToolResultBlockParam[] = [];

  for (const block of contentBlocks) {
    if (block.type !== "tool_use") continue;

    const toolName = block.name;
    const toolInput = block.input;

    onToolUse?.(toolName, toolInput);

    const output = dispatch(toolName, toolInput);

    results.push({
      type: "tool_result",
      tool_use_id: block.id,
      content: output,
    });
  }

  return results;
}

function extractText(contentBlocks: NormalizedContentBlock[]): string {
  return contentBlocks
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
