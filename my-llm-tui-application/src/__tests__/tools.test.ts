import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  setRoot,
  listDirectory,
  readFile,
  searchCode,
  writeFile,
  editFile,
  createDirectory,
  dispatch,
} from "../tools/tools.ts";
import { resetSecurity } from "../security/security.ts";

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
    resetSecurity();
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

  describe("writeFile", () => {
    it("新規ファイルを作成し書き込み完了メッセージを返す", () => {
      const result = writeFile("new.ts", 'const x = 1;\n');
      expect(result).toContain("書き込み完了");
      expect(result).toContain("new.ts");
      expect(fs.existsSync(path.join(tmpDir, "new.ts"))).toBe(true);
    });

    it("成功時に行数を含むメッセージを返す", () => {
      const content = "line1\nline2\nline3";
      const result = writeFile("lines.ts", content);
      expect(result).toContain("3 行");
    });

    it("既存ファイルを上書きできる", () => {
      writeFile("hello.ts", "overwritten\n");
      const content = fs.readFileSync(path.join(tmpDir, "hello.ts"), "utf-8");
      expect(content).toBe("overwritten\n");
    });

    it("親ディレクトリが存在しない場合も作成して書き込める", () => {
      const result = writeFile("deep/nested/file.ts", "content\n");
      expect(result).toContain("書き込み完了");
      expect(fs.existsSync(path.join(tmpDir, "deep", "nested", "file.ts"))).toBe(true);
    });

    it("パストラバーサルをセキュリティエラーとして拒否する", () => {
      const result = writeFile("../../evil.ts", "bad");
      expect(result).toContain("セキュリティエラー");
    });
  });

  describe("editFile", () => {
    it("指定行範囲を新しい内容で置換できる", () => {
      // hello.ts: line1='const msg = "hello";', line2='console.log(msg);', line3=''
      const result = editFile("hello.ts", 1, 1, 'const msg = "replaced";');
      expect(result).toContain("編集完了");
      const content = fs.readFileSync(path.join(tmpDir, "hello.ts"), "utf-8");
      expect(content).toContain('const msg = "replaced";');
      expect(content).toContain("console.log(msg);");
    });

    it("成功時に置換範囲と行数を含むメッセージを返す", () => {
      const result = editFile("hello.ts", 1, 2, "new line 1\nnew line 2");
      expect(result).toContain("1〜2行目を 2 行に置換");
    });

    it("存在しないファイルにはエラーを返す", () => {
      const result = editFile("nonexistent.ts", 1, 1, "x");
      expect(result).toContain("エラー");
      expect(result).toContain("nonexistent.ts");
    });

    it("startLine が 1 未満の場合は行範囲エラーを返す", () => {
      const result = editFile("hello.ts", 0, 1, "x");
      expect(result).toContain("行範囲が不正です");
    });

    it("endLine がファイルの行数を超える場合は行範囲エラーを返す", () => {
      const result = editFile("hello.ts", 1, 999, "x");
      expect(result).toContain("行範囲が不正です");
    });

    it("startLine が endLine より大きい場合は行範囲エラーを返す", () => {
      const result = editFile("hello.ts", 2, 1, "x");
      expect(result).toContain("行範囲が不正です");
    });

    it("パストラバーサルをセキュリティエラーとして拒否する", () => {
      const result = editFile("../../etc/passwd", 1, 1, "x");
      expect(result).toContain("セキュリティエラー");
    });
  });

  describe("createDirectory", () => {
    it("新規ディレクトリを作成してメッセージを返す", () => {
      const result = createDirectory("newdir");
      expect(result).toContain("ディレクトリ作成");
      expect(fs.existsSync(path.join(tmpDir, "newdir"))).toBe(true);
    });

    it("ネストした親ディレクトリも再帰的に作成できる", () => {
      const result = createDirectory("a/b/c");
      expect(result).toContain("ディレクトリ作成");
      expect(fs.existsSync(path.join(tmpDir, "a", "b", "c"))).toBe(true);
    });

    it("すでに存在するディレクトリには既存メッセージを返す", () => {
      const result = createDirectory("sub");
      expect(result).toContain("既に存在します");
    });

    it("パストラバーサルをセキュリティエラーとして拒否する", () => {
      const result = createDirectory("../../evil");
      expect(result).toContain("セキュリティエラー");
    });
  });

  describe("dispatch — 書き込みツール", () => {
    it("write_file を呼び出せる", () => {
      const result = dispatch("write_file", { path: "dispatched.ts", content: "const x = 1;\n" });
      expect(result).toContain("書き込み完了");
    });

    it("edit_file を呼び出せる", () => {
      const result = dispatch("edit_file", {
        path: "hello.ts",
        start_line: 1,
        end_line: 1,
        new_content: 'const msg = "edited";',
      });
      expect(result).toContain("編集完了");
    });

    it("create_directory を呼び出せる", () => {
      const result = dispatch("create_directory", { path: "dispatchdir" });
      expect(result).toContain("ディレクトリ作成");
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
