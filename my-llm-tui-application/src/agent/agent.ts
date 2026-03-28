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

// ========================================================
// 設定
// ========================================================

const MODEL = "claude-sonnet-4-20250514";
const MAX_ITERATIONS = 20;

// ========================================================
// 型定義
// ========================================================

export interface RunOptions {
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

type ContentBlock = Anthropic.Messages.ContentBlock;

// ========================================================
// エージェント本体
// ========================================================

export async function run({
  userMessage,
  conversationHistory,
  projectRoot,
  mode = "coding",
  onTextDelta,
  onToolUse,
}: RunOptions): Promise<RunResult> {
  const useTools = mode !== "chat";
  if (useTools) {
    setRoot(projectRoot);
  }

  const client = new Anthropic();
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
    const requestParams: Anthropic.Messages.MessageStreamParams = {
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: allMessages(),
    };
    if (useTools) {
      requestParams.tools = TOOL_SCHEMAS as unknown as Anthropic.Messages.Tool[];
    }

    const stream = client.messages.stream(requestParams);

    // ストリーミングでテキストをリアルタイム通知
    let currentText = "";
    stream.on("text", (text) => {
      currentText += text;
      onTextDelta?.(currentText);
    });

    const response = await stream.finalMessage();
    tokenUsage = addTokenUsage(tokenUsage, response.usage);

    // アシスタントの返答を履歴に追加
    newMessages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      return {
        text: extractText(response.content),
        newMessages,
        tokenUsage,
      };
    }

    if (response.stop_reason === "tool_use") {
      const toolResults = handleToolUse(response.content, onToolUse);
      newMessages.push({ role: "user", content: toolResults });
      // 次のイテレーションでテキスト表示をリセット
      currentText = "";
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
  contentBlocks: ContentBlock[],
  onToolUse?: (toolName: string, toolInput: Record<string, unknown>) => void,
): Anthropic.Messages.ToolResultBlockParam[] {
  const results: Anthropic.Messages.ToolResultBlockParam[] = [];

  for (const block of contentBlocks) {
    if (block.type !== "tool_use") continue;

    const toolName = block.name;
    const toolInput = block.input as Record<string, unknown>;

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

function extractText(contentBlocks: ContentBlock[]): string {
  return contentBlocks
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
