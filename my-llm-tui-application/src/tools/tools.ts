/**
 * tools.ts — ツール定義 + Executor
 *
 * セキュリティ境界は src/security/security.ts に集約している。
 */

import fs from "fs";
import path from "path";
import {
  setRoot as _setRoot,
  validatePath,
  getAllowedRoot,
} from "../security/security.ts";

// ========================================================
// 設定
// ========================================================

const MAX_FILE_LINES = 500;    // 一度に読む最大行数
const MAX_SEARCH_RESULTS = 20; // grep の最大マッチ数

// ========================================================
// 型定義
// ========================================================

export interface DiffResult {
  unifiedDiff: string;
  filePath: string;
  fileExtension: string;
}

interface EditFileResult {
  message: string;
  diff?: DiffResult;
}

export interface DispatchResult {
  output: string;
  diff?: DiffResult;
}

// ========================================================
// unified diff 生成
// ========================================================

type DiffOp = { op: "keep" | "delete" | "insert"; line: string };

const CONTEXT_LINES = 3;
const MAX_DIFF_LINES = 2000;

function computeLineDiff(oldLines: string[], newLines: string[]): DiffOp[] {
  const N = oldLines.length;
  const M = newLines.length;

  if (N + M > MAX_DIFF_LINES) {
    return [
      ...oldLines.map((line) => ({ op: "delete" as const, line })),
      ...newLines.map((line) => ({ op: "insert" as const, line })),
    ];
  }

  const MAX = N + M;
  const offset = MAX;
  const V = new Array<number>(2 * MAX + 2).fill(-1);
  V[offset + 1] = 0;
  const trace: number[][] = [];

  outer: for (let d = 0; d <= MAX; d++) {
    trace.push([...V]);
    for (let k = -d; k <= d; k += 2) {
      const kIdx = k + offset;
      let x: number;
      if (k === -d || (k !== d && (V[kIdx - 1] ?? -1) < (V[kIdx + 1] ?? -1))) {
        x = V[kIdx + 1] ?? 0;
      } else {
        x = (V[kIdx - 1] ?? 0) + 1;
      }
      let y = x - k;
      while (x < N && y < M && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }
      V[kIdx] = x;
      if (x >= N && y >= M) break outer;
    }
  }

  return backtrack(trace, oldLines, newLines, offset);
}

function backtrack(
  trace: number[][],
  oldLines: string[],
  newLines: string[],
  offset: number
): DiffOp[] {
  const ops: DiffOp[] = [];
  let x = oldLines.length;
  let y = newLines.length;

  for (let d = trace.length - 1; d >= 0; d--) {
    const V = trace[d]!;
    const k = x - y;
    const kIdx = k + offset;
    let prevK: number;
    if (k === -d || (k !== d && (V[kIdx - 1] ?? -1) < (V[kIdx + 1] ?? -1))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = V[prevK + offset] ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
      ops.unshift({ op: "keep", line: oldLines[x]! });
    }

    if (d > 0) {
      if (prevK === k + 1) {
        ops.unshift({ op: "insert", line: newLines[y - 1]! });
        y--;
      } else {
        ops.unshift({ op: "delete", line: oldLines[x - 1]! });
        x--;
      }
    }
  }
  return ops;
}

export function buildUnifiedDiff(
  filePath: string,
  oldLines: string[],
  newLines: string[]
): string {
  const ops = computeLineDiff(oldLines, newLines);
  if (ops.every((o) => o.op === "keep")) return "";

  const hunks: string[] = [];
  let oldPos = 1;
  let newPos = 1;
  let i = 0;

  while (i < ops.length) {
    // 次の変更箇所を探す
    if (ops[i]!.op === "keep") {
      oldPos++;
      newPos++;
      i++;
      continue;
    }

    // 変更ブロックの開始インデックスと、コンテキスト開始位置を決定
    const changeStart = i;
    const ctxStart = Math.max(0, changeStart - CONTEXT_LINES);

    // 変更ブロックの終了を探す（連続する変更 + コンテキスト範囲で結合）
    let changeEnd = i;
    while (changeEnd < ops.length) {
      if (ops[changeEnd]!.op !== "keep") {
        changeEnd++;
      } else {
        // keep が連続する場合、次の変更まで 2*CONTEXT_LINES 以内ならまとめる
        let nextChange = changeEnd + 1;
        while (nextChange < ops.length && ops[nextChange]!.op === "keep") nextChange++;
        if (nextChange < ops.length && nextChange - changeEnd <= 2 * CONTEXT_LINES) {
          changeEnd = nextChange;
        } else {
          break;
        }
      }
    }
    const ctxEnd = Math.min(ops.length, changeEnd + CONTEXT_LINES);

    // ハンクのヘッダー行番号を計算
    let oldStart = 1;
    let newStart = 1;
    let tmpOld = 1;
    let tmpNew = 1;
    for (let j = 0; j < ctxStart; j++) {
      if (ops[j]!.op !== "insert") tmpOld++;
      if (ops[j]!.op !== "delete") tmpNew++;
    }
    oldStart = tmpOld;
    newStart = tmpNew;

    let oldCount = 0;
    let newCount = 0;
    const hunkLines: string[] = [];
    for (let j = ctxStart; j < ctxEnd; j++) {
      const op = ops[j]!;
      if (op.op === "keep") {
        hunkLines.push(` ${op.line}`);
        oldCount++;
        newCount++;
      } else if (op.op === "delete") {
        hunkLines.push(`-${op.line}`);
        oldCount++;
      } else {
        hunkLines.push(`+${op.line}`);
        newCount++;
      }
    }

    hunks.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    hunks.push(...hunkLines);

    // 次のイテレーションのために i を ctxEnd に進める
    i = ctxEnd;
    // oldPos/newPos を ctxEnd まで進める（使用しないが一貫性のため）
    for (let j = ctxStart; j < ctxEnd; j++) {
      if (ops[j]!.op !== "insert") oldPos++;
      if (ops[j]!.op !== "delete") newPos++;
    }
  }

  if (hunks.length === 0) return "";
  return `--- a/${filePath}\n+++ b/${filePath}\n${hunks.join("\n")}`;
}

const IGNORE_DIRS = new Set([".git", "__pycache__", "node_modules", ".venv", "dist", "build"]);
const SKIP_EXTENSIONS = new Set([".pyc", ".lock", ".png", ".jpg", ".svg", ".woff", ".ttf"]);

/** セキュリティモジュールへの委譲（後方互換のため re-export） */
export function setRoot(rootPath: string): void {
  _setRoot(rootPath);
}

// ========================================================
// ツール実装
// ========================================================

export function listDirectory(inputPath: string = "."): string {
  let target: string;
  try {
    target = validatePath(inputPath);
  } catch (e) {
    return `セキュリティエラー: ${(e as Error).message}`;
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    return `エラー: ${inputPath} はディレクトリではありません`;
  }

  const lines: string[] = [`# ${inputPath}/`];

  function walk(dirPath: string, prefix: string, depth: number): void {
    if (depth > 4) return; // 深さ制限（拡張点: 設定化）

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    // ディレクトリ優先、名前順にソート
    entries = entries
      .filter((e) => !e.name.startsWith(".") && !IGNORE_DIRS.has(e.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    entries.forEach((entry, i) => {
      const isLast = i === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const suffix = entry.isDirectory() ? "/" : "";
      lines.push(`${prefix}${connector}${entry.name}${suffix}`);

      if (entry.isDirectory()) {
        const extension = isLast ? "    " : "│   ";
        walk(path.join(dirPath, entry.name), prefix + extension, depth + 1);
      }
    });
  }

  walk(target, "", 0);
  return lines.join("\n");
}

export function readFile(
  inputPath: string,
  startLine: number = 1,
  endLine?: number
): string {
  let target: string;
  try {
    target = validatePath(inputPath);
  } catch (e) {
    return `セキュリティエラー: ${(e as Error).message}`;
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return `エラー: ${inputPath} はファイルではありません`;
  }

  let lines: string[];
  try {
    lines = fs.readFileSync(target, "utf-8").split("\n");
  } catch (e) {
    return `エラー: 読み取り失敗 (${(e as Error).message})`;
  }

  const total = lines.length;
  const s = Math.max(1, startLine) - 1;               // 0-indexed
  let e = endLine ? Math.min(total, endLine) : total;  // 0-indexed exclusive

  let truncated = false;
  if (e - s > MAX_FILE_LINES) {
    e = s + MAX_FILE_LINES;
    truncated = true;
  }

  const numbered = lines
    .slice(s, e)
    .map((line, i) => `${String(s + i + 1).padStart(4)} | ${line}`)
    .join("\n");

  if (truncated) {
    return (
      numbered +
      `\n\n... (表示: ${s + 1}〜${e}行目 / 全${total}行)` +
      `\n続きを読むには: read_file("${inputPath}", ${e + 1})`
    );
  }
  return `# ${inputPath} (${s + 1}〜${e}行目 / 全${total}行)\n` + numbered;
}

export function searchCode(pattern: string, inputPath: string = "."): string {
  let target: string;
  try {
    target = validatePath(inputPath);
  } catch (e) {
    return `セキュリティエラー: ${(e as Error).message}`;
  }

  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch (e) {
    return `エラー: 無効な正規表現 (${(e as Error).message})`;
  }

  const results: string[] = [];

  function searchFile(filePath: string): void {
    if (results.length >= MAX_SEARCH_RESULTS) return;
    let fileLines: string[];
    try {
      fileLines = fs.readFileSync(filePath, "utf-8").split("\n");
    } catch {
      return;
    }
    const rel = path.relative(getAllowedRoot()!, filePath);
    for (let i = 0; i < fileLines.length; i++) {
      if (regex.test(fileLines[i]!)) {
        results.push(`${rel}:${i + 1}: ${fileLines[i]!.trimEnd()}`);
        if (results.length >= MAX_SEARCH_RESULTS) return;
      }
    }
  }

  function walkAndSearch(dirPath: string): void {
    if (results.length >= MAX_SEARCH_RESULTS) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || IGNORE_DIRS.has(entry.name)) continue;
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walkAndSearch(full);
      } else if (entry.isFile() && !SKIP_EXTENSIONS.has(path.extname(entry.name))) {
        searchFile(full);
      }
      if (results.length >= MAX_SEARCH_RESULTS) break;
    }
  }

  const stat = fs.statSync(target);
  if (stat.isFile()) {
    searchFile(target);
  } else if (stat.isDirectory()) {
    walkAndSearch(target);
  }

  if (results.length === 0) {
    return `マッチなし: pattern=${JSON.stringify(pattern)} in ${inputPath}`;
  }

  let header = `# search: ${JSON.stringify(pattern)} in ${inputPath} (${results.length} 件)`;
  if (results.length >= MAX_SEARCH_RESULTS) {
    header += "  ※ 上限に達しました。pattern を絞るか path を限定してください";
  }
  return header + "\n" + results.join("\n");
}

export function writeFile(inputPath: string, content: string): string {
  let target: string;
  try {
    target = validatePath(inputPath);
  } catch (e) {
    return `セキュリティエラー: ${(e as Error).message}`;
  }

  try {
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(target, content, "utf-8");
  } catch (e) {
    return `エラー: ${(e as Error).message}`;
  }

  const lineCount = content.split("\n").length;
  return `書き込み完了: ${inputPath} (${lineCount} 行)`;
}

function editFileInternal(
  inputPath: string,
  startLine: number,
  endLine: number,
  newContent: string
): EditFileResult {
  let target: string;
  try {
    target = validatePath(inputPath);
  } catch (e) {
    return { message: `セキュリティエラー: ${(e as Error).message}` };
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return { message: `エラー: ${inputPath} はファイルではありません` };
  }

  let lines: string[];
  try {
    lines = fs.readFileSync(target, "utf-8").split("\n");
  } catch (e) {
    return { message: `エラー: 読み取り失敗 (${(e as Error).message})` };
  }

  const total = lines.length;
  if (startLine < 1 || endLine > total || startLine > endLine) {
    return { message: `エラー: 行範囲が不正です (${startLine}〜${endLine} / 全${total}行)` };
  }

  const oldLines = [...lines];
  const newLines = newContent.split("\n");
  const s = startLine - 1; // 0-indexed
  lines.splice(s, endLine - startLine + 1, ...newLines);

  try {
    fs.writeFileSync(target, lines.join("\n"), "utf-8");
  } catch (e) {
    return { message: `エラー: ${(e as Error).message}` };
  }

  const ext = inputPath.split(".").pop() ?? "";
  const unifiedDiff = buildUnifiedDiff(inputPath, oldLines, lines);
  return {
    message: `編集完了: ${inputPath} (${startLine}〜${endLine}行目を ${newLines.length} 行に置換)`,
    diff: unifiedDiff ? { unifiedDiff, filePath: inputPath, fileExtension: ext } : undefined,
  };
}

export function editFile(
  inputPath: string,
  startLine: number,
  endLine: number,
  newContent: string
): string {
  return editFileInternal(inputPath, startLine, endLine, newContent).message;
}

/** ファイルを書き込まずに編集後の差分だけを計算して返す（確認 UI 用） */
export function previewEditDiff(
  inputPath: string,
  startLine: number,
  endLine: number,
  newContent: string
): DiffResult | undefined {
  let target: string;
  try {
    target = validatePath(inputPath);
  } catch {
    return undefined;
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return undefined;

  let lines: string[];
  try {
    lines = fs.readFileSync(target, "utf-8").split("\n");
  } catch {
    return undefined;
  }

  const total = lines.length;
  if (startLine < 1 || endLine > total || startLine > endLine) return undefined;

  const oldLines = [...lines];
  const newLines = newContent.split("\n");
  const s = startLine - 1;
  lines.splice(s, endLine - startLine + 1, ...newLines);

  const ext = inputPath.split(".").pop() ?? "";
  const unifiedDiff = buildUnifiedDiff(inputPath, oldLines, lines);
  return unifiedDiff ? { unifiedDiff, filePath: inputPath, fileExtension: ext } : undefined;
}

export function createDirectory(inputPath: string): string {
  let target: string;
  try {
    target = validatePath(inputPath);
  } catch (e) {
    return `セキュリティエラー: ${(e as Error).message}`;
  }

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    return `既に存在します: ${inputPath}`;
  }

  try {
    fs.mkdirSync(target, { recursive: true });
  } catch (e) {
    return `エラー: ${(e as Error).message}`;
  }

  return `ディレクトリ作成: ${inputPath}`;
}

// ========================================================
// Anthropic API に渡す tools スキーマ
// ========================================================

export const TOOL_SCHEMAS = [
  {
    name: "list_directory",
    description:
      "ディレクトリ内のファイル・フォルダの一覧をツリー形式で返す。" +
      "まずここを呼んでプロジェクト構造を把握するとよい。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "調べるディレクトリのパス（ルートからの相対パス）。省略時は '.'",
          default: ".",
        },
      },
    },
  },
  {
    name: "read_file",
    description:
      "ソースファイルを読む。start_line / end_line で範囲指定可能。" +
      "大きなファイルは範囲を絞って複数回に分けて読むこと。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "読むファイルのパス（ルートからの相対パス）",
        },
        start_line: {
          type: "integer",
          description: "読み始め行番号（1始まり）。省略時は先頭",
          default: 1,
        },
        end_line: {
          type: "integer",
          description: "読み終わり行番号（1始まり、含む）。省略時はファイル末尾まで",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "search_code",
    description:
      "正規表現でコードを検索し、マッチ箇所のファイル名と行番号を返す。" +
      "関数名・クラス名・エラーメッセージなどを手がかりに場所を特定するのに使う。",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description:
            "検索する正規表現パターン（例: 'function processOrder', 'TODO', 'throw new Error'）",
        },
        path: {
          type: "string",
          description: "検索対象のファイルまたはディレクトリ。省略時はルート全体",
          default: ".",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "write_file",
    description:
      "ファイルを新規作成または全体を上書きする。" +
      "親ディレクトリが存在しない場合は自動作成する。" +
      "既存ファイルは確認なしで上書きされるため、edit_file で部分変更できる場合はそちらを優先すること。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "書き込み先のパス（ルートからの相対パス）",
        },
        content: {
          type: "string",
          description: "書き込むファイルの内容（全体）",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description:
      "ファイルの指定行範囲を新しい内容で置換する。" +
      "search_code や read_file で行番号を確認してから呼ぶこと。" +
      "ファイル全体を書き換えたい場合は write_file を使うこと。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "編集するファイルのパス（ルートからの相対パス）",
        },
        start_line: {
          type: "integer",
          description: "置換開始行番号（1始まり、含む）",
        },
        end_line: {
          type: "integer",
          description: "置換終了行番号（1始まり、含む）",
        },
        new_content: {
          type: "string",
          description: "置換後の内容。複数行の場合は改行文字 \\n を含む文字列",
        },
      },
      required: ["path", "start_line", "end_line", "new_content"],
    },
  },
  {
    name: "create_directory",
    description:
      "ディレクトリを作成する。親ディレクトリが存在しない場合も再帰的に作成する。" +
      "write_file は親ディレクトリを自動作成するため、" +
      "このツールは空ディレクトリを明示的に作りたい場合に使う。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "作成するディレクトリのパス（ルートからの相対パス）",
        },
      },
      required: ["path"],
    },
  },
] as const;

// ========================================================
// ツール呼び出しディスパッチャ
// ========================================================

type ToolInput = Record<string, unknown>;

export function dispatch(toolName: string, toolInput: ToolInput): DispatchResult {
  try {
    switch (toolName) {
      case "list_directory":
        return { output: listDirectory((toolInput.path as string) ?? ".") };
      case "read_file":
        return {
          output: readFile(
            toolInput.path as string,
            toolInput.start_line as number | undefined,
            toolInput.end_line as number | undefined
          ),
        };
      case "search_code":
        return {
          output: searchCode(
            toolInput.pattern as string,
            (toolInput.path as string) ?? "."
          ),
        };
      case "write_file":
        return {
          output: writeFile(
            toolInput.path as string,
            toolInput.content as string
          ),
        };
      case "edit_file": {
        const result = editFileInternal(
          toolInput.path as string,
          toolInput.start_line as number,
          toolInput.end_line as number,
          toolInput.new_content as string
        );
        return { output: result.message, diff: result.diff };
      }
      case "create_directory":
        return { output: createDirectory(toolInput.path as string) };
      default:
        return { output: `エラー: 未知のツール '${toolName}'` };
    }
  } catch (e) {
    return { output: `実行エラー (${toolName}): ${(e as Error).message}` };
  }
}
