import { run } from "../agent/agent.ts";
import { setProjectContext } from "../agent/projectContext.ts";
import { registerCommand } from "./registry.ts";
import type { CommandContext } from "./types.ts";

export const INIT_PROMPT = `\
このディレクトリを探索して、プロジェクトの概要をまとめてください。

ディレクトリ構造とファイル内容から以下を読み取ること：
- このプロジェクトが解決しようとしていること（目的・関心事）
- 使われている言語・フレームワーク・主要ライブラリ
- 各関心事がどのファイル・関数・クラスによってどの程度実装されているか

出力は以下の形式でまとめること：

## プロジェクト概要

### 目的・関心事
プロジェクトが解決しようとしていること、主要な関心事を箇条書きで列挙する。

### 技術スタック
- 言語:
- フレームワーク・ライブラリ:

### 関心事と実装の対応

| 関心事 | 実装ファイル | 主要な実装（関数・クラス・コンポーネント） | 実装度 |
|--------|-------------|------------------------------------------|--------|

実装度は「完全」「部分的」「stub」のいずれかで記述すること。`;

export function registerInitCommand(ctx: CommandContext): void {
  registerCommand({
    name: "init",
    description: "プロジェクトの概要（目的・技術スタック・実装対応）を生成しキャッシュする",
    handler: async (_args) => {
      ctx.setLoading(true);
      ctx.addAssistantMessage("");
      try {
        const result = await run({
          provider: ctx.provider,
          model: ctx.model,
          userMessage: INIT_PROMPT,
          conversationHistory: [],
          projectRoot: ctx.projectRoot,
          mode: "coding",
          securityConfig: ctx.securityConfig,
          onTextDelta: (fullText) => ctx.updateLastAssistantMessage(fullText),
          onToolUse: (toolName, toolInput) => {
            const preview = JSON.stringify(toolInput).slice(0, 80);
            ctx.updateLastAssistantMessage(`[分析中] ${toolName}(${preview})\n`);
          },
        });
        setProjectContext(result.text);
        ctx.updateLastAssistantMessage(result.text);
        ctx.updateTokenUsage(result.tokenUsage.inputTokens, result.tokenUsage.outputTokens);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "不明なエラー";
        ctx.updateLastAssistantMessage(`/init エラー: ${msg}`);
      } finally {
        ctx.setLoading(false);
      }
    },
  });
}
