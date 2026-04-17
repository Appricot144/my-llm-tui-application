/** "/" で始まる入力をコマンドとして解析するユーティリティ */

export interface ParsedCommand {
  /** コマンド名（"/" を除いた [a-zA-Z-]+ 部分） */
  commandName: string;
  /** コマンド名の後に続く引数文字列（トリム済み） */
  args: string;
}

const COMMAND_NAME_PATTERN = /^\/([a-zA-Z-]+)(.*)?$/;

/**
 * 入力文字列をコマンドとして解析する。
 * "/" 始まりでコマンド名部分 ([a-zA-Z-]+) を持つ場合のみ ParsedCommand を返し、
 * それ以外は null を返す。
 */
export function parseCommand(input: string): ParsedCommand | null {
  const match = input.match(COMMAND_NAME_PATTERN);
  if (!match) return null;
  return {
    commandName: match[1]!,
    args: match[2]?.trim() ?? "",
  };
}

/**
 * 入力文字列がコマンド入力モードかどうかを返す。
 * "/" で始まれば、コマンド名が完成していなくてもコマンドモードとみなす。
 */
export function isCommandInput(input: string): boolean {
  return input.startsWith("/");
}
