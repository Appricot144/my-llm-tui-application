export function isPrintableCharacter(char: string): boolean {
  if (char.length === 0) return false;

  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return false;

  // サロゲートペアを考慮した1文字判定
  const charLength = codePoint > 0xFFFF ? 2 : 1;
  if (char.length !== charLength) return false;

  // 制御文字を除外（U+0000〜U+001F, U+007F）
  if (codePoint <= 0x1F || codePoint === 0x7F) return false;

  // U+0020（スペース）以上は印字可能
  return true;
}
