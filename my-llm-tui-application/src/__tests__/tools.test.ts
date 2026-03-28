import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  setRoot,
  listDirectory,
  readFile,
  searchCode,
  dispatch,
} from "../tools/tools.ts";

// テスト用の一時ディレクトリを作成
function createTempProject(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-test-"));
  fs.writeFileSync(path.join(tmpDir, "hello.ts"), 'const msg = "hello";\nconsole.log(msg);\n');
  fs.writeFileSync(path.join(tmpDir, "world.ts"), 'export function world() {\n  return "world";\n}\n');
  fs.mkdirSync(path.join(tmpDir, "sub"));
  fs.writeFileSync(path.join(tmpDir, "sub", "nested.ts"), 'const x = 42;\n');
  return tmpDir;
}

describe("tools", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempProject();
    setRoot(tmpDir);
  });

  describe("listDirectory", () => {
    it("ルートディレクトリのファイル一覧を返す", () => {
      const result = listDirectory(".");
      expect(result).toContain("hello.ts");
      expect(result).toContain("world.ts");
      expect(result).toContain("sub/");
    });

    it("存在しないディレクトリでエラーを返す", () => {
      const result = listDirectory("nonexistent");
      expect(result).toContain("エラー");
    });
  });

  describe("readFile", () => {
    it("ファイルの内容を行番号付きで返す", () => {
      const result = readFile("hello.ts");
      expect(result).toContain("hello");
      expect(result).toContain("1 |");
    });

    it("行範囲を指定して読める", () => {
      const result = readFile("hello.ts", 2, 2);
      expect(result).toContain("console.log");
      expect(result).not.toContain('const msg');
    });

    it("存在しないファイルでエラーを返す", () => {
      const result = readFile("nonexistent.ts");
      expect(result).toContain("エラー");
    });
  });

  describe("searchCode", () => {
    it("パターンに一致する箇所を返す", () => {
      const result = searchCode("hello");
      expect(result).toContain("hello.ts");
      expect(result).toContain(":1:");
    });

    it("複数ファイルを横断して検索できる", () => {
      const result = searchCode("const");
      expect(result).toContain("hello.ts");
      expect(result).toContain("nested.ts");
    });

    it("マッチしない場合はその旨を返す", () => {
      const result = searchCode("zzz_not_found_zzz");
      expect(result).toContain("マッチなし");
    });
  });

  describe("dispatch", () => {
    it("list_directory を呼び出せる", () => {
      const result = dispatch("list_directory", { path: "." });
      expect(result).toContain("hello.ts");
    });

    it("read_file を呼び出せる", () => {
      const result = dispatch("read_file", { path: "hello.ts" });
      expect(result).toContain("hello");
    });

    it("search_code を呼び出せる", () => {
      const result = dispatch("search_code", { pattern: "world" });
      expect(result).toContain("world.ts");
    });

    it("未知のツール名でエラーを返す", () => {
      const result = dispatch("unknown_tool", {});
      expect(result).toContain("未知のツール");
    });
  });

  describe("セキュリティ", () => {
    it("パストラバーサルを拒否する", () => {
      const result = readFile("../../etc/passwd");
      expect(result).toContain("セキュリティエラー");
    });

    it("絶対パスでルート外へのアクセスを拒否する", () => {
      const result = readFile("/etc/passwd");
      expect(result).toContain("セキュリティエラー");
    });
  });
});
