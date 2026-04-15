/**
 * security.ts — セキュリティポリシーの集約
 *
 * - パストラバーサル防止（allowedRoot 外へのアクセスを拒否）
 * - denylist: 特定パスへのアクセスを拒否
 * - allowlist: 指定がある場合、そのパスのみ許可
 */

import fs from "fs";
import path from "path";
import type { SecurityConfig } from "../config/config.ts";

// ========================================================
// 状態
// ========================================================

let allowedRoot: string | null = null;
let securityConfig: SecurityConfig = {};

// ========================================================
// 初期化
// ========================================================

export function setRoot(rootPath: string): void {
  allowedRoot = fs.realpathSync(path.resolve(rootPath));
}

export function setSecurityConfig(config: SecurityConfig): void {
  securityConfig = config;
}

/** テスト用: 状態をリセットする */
export function resetSecurity(): void {
  allowedRoot = null;
  securityConfig = {};
}

// ========================================================
// パス検証
// ========================================================

/**
 * inputPath を解決し、セキュリティポリシーに違反する場合は Error を投げる。
 * 成功した場合は絶対パスを返す。
 */
export function validatePath(inputPath: string): string {
  if (!allowedRoot) throw new Error("setRoot() が呼ばれていません");

  const resolved = path.resolve(allowedRoot, inputPath);

  // パストラバーサル防止
  if (!resolved.startsWith(allowedRoot + path.sep) && resolved !== allowedRoot) {
    throw new Error(`アクセス拒否: ${inputPath} は許可されたディレクトリ外です`);
  }

  // denylist チェック（相対パスのプレフィックス一致）
  for (const denied of securityConfig.denylist ?? []) {
    const deniedAbs = path.resolve(allowedRoot, denied);
    if (resolved === deniedAbs || resolved.startsWith(deniedAbs + path.sep)) {
      throw new Error(`アクセス拒否: ${inputPath} は denylist に含まれています`);
    }
  }

  // allowlist チェック（指定がある場合のみ）
  const allowlist = securityConfig.allowlist;
  if (allowlist && allowlist.length > 0) {
    const permitted = allowlist.some((allowed) => {
      const allowedAbs = path.resolve(allowedRoot!, allowed);
      return resolved === allowedAbs || resolved.startsWith(allowedAbs + path.sep);
    });
    if (!permitted) {
      throw new Error(`アクセス拒否: ${inputPath} は allowlist 外です`);
    }
  }

  return resolved;
}

/** 現在の allowedRoot を返す（tools.ts 内の path.relative 等で使用） */
export function getAllowedRoot(): string | null {
  return allowedRoot;
}
