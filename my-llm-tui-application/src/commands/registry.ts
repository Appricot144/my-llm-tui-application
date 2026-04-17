/** コマンド登録・実行レジストリ */

export type CommandHandler = (args: string) => void | Promise<void>;

export interface CommandDefinition {
  /** コマンド名（例: "help", "clear"）。"/" は含まない */
  name: string;
  /** コマンドの説明文 */
  description: string;
  /** コマンド実行時に呼ばれる関数 */
  handler: CommandHandler;
}

const registry = new Map<string, CommandDefinition>();

/** コマンドを登録する */
export function registerCommand(def: CommandDefinition): void {
  registry.set(def.name, def);
}

/** コマンド名からコマンド定義を取得する */
export function getCommand(name: string): CommandDefinition | undefined {
  return registry.get(name);
}

/**
 * コマンドを実行する。
 * @returns コマンドが見つかり実行された場合 true、未知のコマンドの場合 false
 */
export function executeCommand(name: string, args: string): boolean {
  const cmd = registry.get(name);
  if (!cmd) return false;
  void cmd.handler(args);
  return true;
}

/** 登録済みの全コマンドを返す */
export function getAllCommands(): CommandDefinition[] {
  return Array.from(registry.values());
}

/** テスト用：レジストリをリセットする */
export function resetRegistry(): void {
  registry.clear();
}
