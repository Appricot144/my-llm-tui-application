import { describe, it, expect } from "vitest";
import { tokenizeCode } from "../utils/syntaxHighlight.ts";

describe("tokenizeCode", () => {
  it("空文字列は1行の空トークンを返す", () => {
    const result = tokenizeCode("", "ts");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([{ text: "", color: "#d4d4d4" }]);
  });

  it("末尾に改行がある場合は末尾の空行を除去する", () => {
    const result = tokenizeCode("const x = 1;\n", "ts");
    expect(result).toHaveLength(1);
  });

  it("TypeScript のキーワードを紫でトークナイズする", () => {
    const result = tokenizeCode("const x = 1;", "typescript");
    const allTokens = result.flat();
    const constToken = allTokens.find((t) => t.text === "const");
    expect(constToken).toBeDefined();
    expect(constToken?.color).toBe("#c586c0");
  });

  it("数値を薄緑でトークナイズする", () => {
    const result = tokenizeCode("let n = 42;", "ts");
    const allTokens = result.flat();
    const numToken = allTokens.find((t) => t.text === "42");
    expect(numToken).toBeDefined();
    expect(numToken?.color).toBe("#b5cea8");
  });

  it("文字列リテラルを橙色でトークナイズする", () => {
    const result = tokenizeCode('const s = "hello";', "ts");
    const allTokens = result.flat();
    const strToken = allTokens.find((t) => t.text === '"hello"');
    expect(strToken).toBeDefined();
    expect(strToken?.color).toBe("#ce9178");
  });

  it("// コメントを緑でトークナイズする", () => {
    const result = tokenizeCode("// これはコメント", "ts");
    const allTokens = result.flat();
    const commentToken = allTokens.find((t) => t.text.startsWith("//"));
    expect(commentToken).toBeDefined();
    expect(commentToken?.color).toBe("#6a9955");
  });

  it("Python のキーワードを正しく認識する", () => {
    const result = tokenizeCode("def greet(name):", "python");
    const allTokens = result.flat();
    const defToken = allTokens.find((t) => t.text === "def");
    expect(defToken).toBeDefined();
    expect(defToken?.color).toBe("#c586c0");
  });

  it("複数行のコードを行ごとに返す", () => {
    const code = "const a = 1;\nconst b = 2;\n";
    const result = tokenizeCode(code, "ts");
    expect(result).toHaveLength(2);
  });

  it("# コメント (Python) を緑でトークナイズする", () => {
    const result = tokenizeCode("# comment", "python");
    const allTokens = result.flat();
    const commentToken = allTokens.find((t) => t.text.startsWith("#"));
    expect(commentToken).toBeDefined();
    expect(commentToken?.color).toBe("#6a9955");
  });
});
