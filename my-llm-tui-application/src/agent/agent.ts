/**
 * agent.ts — エージェントループ
 *
 * LLM が "もう十分" と判断するまで tool_use → dispatch → 結果追加 を繰り返す。
 */

import Anthropic from "@anthropic-ai/sdk";
import { TOOL_SCHEMAS, dispatch, setRoot } from "./tools.js";
import { getPrompt, type Mode } from "./prompts.js";

// ========================================================
// 設定
// ========================================================

const MODEL = "claude-sonnet-4-20250514";
const MAX_ITERATIONS = 20; // 無限ループ防止（拡張点: モード別に変えてもよい）

// ========================================================
// 型定義
// ========================================================

interface RunOptions {
  userMessage: string;
  projectRoot: string;
  mode?: Mode;
  verbose?: boolean;
}

type MessageParam = Anthropic.Messages.MessageParam;
type ContentBlock = Anthropic.Messages.ContentBlock;

// ========================================================
// エージェント本体
// ========================================================

/**
 * @param userMessage  ユーザーの依頼（バグ説明・レビュー依頼・機能追加依頼など）
 * @param projectRoot  読み込みを許可するルートディレクトリ
 * @param mode         "debug" | "review" | "coding"
 * @param verbose      true にするとツール呼び出しの様子をリアルタイム表示
 * @returns            最終的な LLM の回答テキスト
 */
export async function run({
  userMessage,
  projectRoot,
  mode = "debug",
  verbose = true,
}: RunOptions): Promise<string> {
  // セキュリティ境界を設定
  setRoot(projectRoot);

  const client = new Anthropic();
  const systemPrompt = getPrompt(mode);

  // 会話履歴（tool_use と tool_result はペアで記録する）
  const messages: MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (verbose) console.log(`\n--- iteration ${iteration + 1} ---`);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOL_SCHEMAS as Anthropic.Messages.Tool[],
      messages,
    });

    // アシスタントの返答を履歴に追加
    messages.push({ role: "assistant", content: response.content });

    // ========== stop_reason で分岐 ==========

    if (response.stop_reason === "end_turn") {
      // ツール呼び出しなし → 最終回答
      const finalText = extractText(response.content);
      if (verbose) {
        console.log("\n=== 最終回答 ===");
        console.log(finalText);
      }
      return finalText;
    }

    if (response.stop_reason === "tool_use") {
      // ツール呼び出しを処理して結果を履歴に追加
      const toolResults = handleToolUse(response.content, verbose);
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // 予期しない stop_reason
    break;
  }

  return "エラー: 最大反復回数に達しました";
}

// ========================================================
// 内部ヘルパー
// ========================================================

function handleToolUse(
  contentBlocks: ContentBlock[],
  verbose: boolean
): Anthropic.Messages.ToolResultBlockParam[] {
  const results: Anthropic.Messages.ToolResultBlockParam[] = [];

  for (const block of contentBlocks) {
    if (block.type !== "tool_use") continue;

    const toolName = block.name;
    const toolInput = block.input as Record<string, unknown>;

    if (verbose) {
      console.log(`  [tool] ${toolName}(${JSON.stringify(toolInput)})`);
    }

    const output = dispatch(toolName, toolInput);

    if (verbose) {
      const preview = output.slice(0, 200).replace(/\n/g, "\\n");
      console.log(`  [result] ${preview}${output.length > 200 ? "..." : ""}`);
    }

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

// ========================================================
// CLI エントリポイント（簡易）
// ========================================================

// 使い方: npx tsx agent.ts <project_root> <mode> "<message>"
// 例:     npx tsx agent.ts ./my_project debug "calculate() が undefined を返す原因を調べて"

const args = process.argv.slice(2);
if (args.length >= 3) {
  const [projectRoot, mode, ...rest] = args;
  const userMessage = rest.join(" ");

  run({
    userMessage,
    projectRoot,
    mode: mode as Mode,
    verbose: true,
  }).catch((e) => {
    console.error("エラー:", e);
    process.exit(1);
  });
} else if (args.length > 0) {
  console.error('Usage: npx tsx agent.ts <project_root> <mode> "<message>"');
  console.error("  mode: debug | review | coding");
  process.exit(1);
}
