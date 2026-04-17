/**
 * agent.ts — エージェントループ
 *
 * LLM が "もう十分" と判断するまで tool_use → dispatch → 結果追加 を繰り返す。
 * ストリーミング対応で、テキスト生成をリアルタイムにコールバックで通知する。
 */

import { TOOL_SCHEMAS, dispatch, setRoot } from "../tools/tools.ts";
import { setSecurityConfig } from "../security/security.ts";
import { getPrompt, type Mode } from "./prompts.ts";
import { createTokenUsage, addTokenUsage, type TokenUsage } from "../utils/tokenUsage.ts";
import type { SecurityConfig } from "../config/config.ts";
import type {
  LLMProvider,
  MessageParam,
  ContentBlockParam,
  ToolResultBlockParam,
  NormalizedContentBlock,
} from "../providers/types.ts";

// ========================================================
// 定数
// ========================================================

const MAX_ITERATIONS = 20;
const MAX_TOKENS = 4096;

/** 実行前にユーザー確認が必要なツール */
const WRITE_TOOLS = new Set(["write_file", "edit_file", "create_directory"]);

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
  conversationHistory: MessageParam[];
  /** 読み込みを許可するルートディレクトリ */
  projectRoot: string;
  /** エージェントのモード */
  mode?: Mode;
  /** セキュリティポリシー設定 */
  securityConfig?: SecurityConfig;
  /** テキスト生成時のコールバック（ストリーミング用） */
  onTextDelta?: (fullText: string) => void;
  /** ツール呼び出し時のコールバック（UI表示用） */
  onToolUse?: (toolName: string, toolInput: Record<string, unknown>) => void;
  /** 書き込みツール実行前の承認コールバック。false を返すとキャンセル */
  onToolConfirm?: (toolName: string, toolInput: Record<string, unknown>) => Promise<boolean>;
}

export interface RunResult {
  /** 最終的な LLM の回答テキスト */
  text: string;
  /** エージェントループ中の全メッセージ（履歴更新用） */
  newMessages: MessageParam[];
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
  securityConfig,
  onTextDelta,
  onToolUse,
  onToolConfirm,
}: RunOptions): Promise<RunResult> {
  const useTools = mode !== "chat" && provider.supportsTools;
  if (useTools) {
    setRoot(projectRoot);
    setSecurityConfig(securityConfig ?? {});
  }

  const systemPrompt = getPrompt(mode);

  // エージェントループ中に追加されるメッセージ
  const newMessages: MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // API に渡す全メッセージ = 過去の履歴 + 今回の新規メッセージ
  const allMessages = (): MessageParam[] => [
    ...conversationHistory,
    ...newMessages,
  ];

  let tokenUsage = createTokenUsage();
  const fileCache = new Map<string, string>();

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
      content: response.content as ContentBlockParam[],
    });

    if (response.stopReason === "end_turn" || response.stopReason === "max_tokens") {
      return {
        text: extractText(response.content),
        newMessages,
        tokenUsage,
      };
    }

    if (response.stopReason === "tool_use") {
      const toolResults = await handleToolUse(response.content, fileCache, onToolUse, onToolConfirm);
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

async function handleToolUse(
  contentBlocks: NormalizedContentBlock[],
  fileCache: Map<string, string>,
  onToolUse?: (toolName: string, toolInput: Record<string, unknown>) => void,
  onToolConfirm?: (toolName: string, toolInput: Record<string, unknown>) => Promise<boolean>,
): Promise<ToolResultBlockParam[]> {
  const results: ToolResultBlockParam[] = [];

  for (const block of contentBlocks) {
    if (block.type !== "tool_use") continue;

    const toolName = block.name;
    const toolInput = block.input;

    onToolUse?.(toolName, toolInput);

    // 書き込みツールは実行前にユーザー確認を取る
    if (WRITE_TOOLS.has(toolName) && onToolConfirm) {
      const confirmed = await onToolConfirm(toolName, toolInput);
      if (!confirmed) {
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: "ユーザーによりキャンセルされました",
        });
        continue;
      }
    }

    // 書き込みツールはキャッシュを全クリアしてから実行
    if (WRITE_TOOLS.has(toolName)) {
      fileCache.clear();
    }

    const cacheKey = buildCacheKey(toolName, toolInput);
    let output: string;
    if (cacheKey !== null && fileCache.has(cacheKey)) {
      output = fileCache.get(cacheKey)!;
    } else {
      output = dispatch(toolName, toolInput);
      if (cacheKey !== null) {
        fileCache.set(cacheKey, output);
      }
    }

    results.push({
      type: "tool_result",
      tool_use_id: block.id,
      content: output,
    });
  }

  return results;
}

/**
 * 読み取り専用ツールに対してキャッシュキーを生成する。
 * 書き込みツール（write_file, edit_file, create_directory）は null を返す。
 */
export function buildCacheKey(
  toolName: string,
  toolInput: Record<string, unknown>
): string | null {
  switch (toolName) {
    case "read_file":
      return `read_file:${toolInput.path}:${toolInput.start_line ?? ""}:${toolInput.end_line ?? ""}`;
    case "list_directory":
      return `list_directory:${toolInput.path ?? "."}`;
    case "search_code":
      return `search_code:${toolInput.pattern}:${toolInput.path ?? "."}`;
    default:
      return null;
  }
}

function extractText(contentBlocks: NormalizedContentBlock[]): string {
  return contentBlocks
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
