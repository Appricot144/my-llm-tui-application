/**
 * プロジェクト文脈のメモリキャッシュ
 *
 * /init コマンドの実行結果（関心事・技術スタック・実装対応）を保持し、
 * 以後のエージェント呼び出しでシステムプロンプトに自動注入することで
 * LLM によるファイル再探索コストを削減する。
 */

let cachedContext: string | null = null;

export function setProjectContext(context: string): void {
  cachedContext = context;
}

export function getProjectContext(): string | null {
  return cachedContext;
}

export function clearProjectContext(): void {
  cachedContext = null;
}
