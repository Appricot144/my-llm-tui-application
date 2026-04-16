import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../utils/markdownParser.ts";

describe("parseMarkdown", () => {
  it("テキストのみの場合、テキストセグメント1つを返す", () => {
    const result = parseMarkdown("hello world");
    expect(result).toEqual([{ type: "text", content: "hello world" }]);
  });

  it("空文字列の場合、テキストセグメント1つを返す", () => {
    const result = parseMarkdown("");
    expect(result).toEqual([{ type: "text", content: "" }]);
  });

  it("コードブロック1つだけの場合、コードセグメント1つを返す", () => {
    const input = "```typescript\nconst x = 1;\n```";
    const result = parseMarkdown(input);
    expect(result).toEqual([
      { type: "code", content: "const x = 1;\n", language: "typescript" },
    ]);
  });

  it("言語指定なしのコードブロックは language が 'text' になる", () => {
    const input = "```\nhello\n```";
    const result = parseMarkdown(input);
    expect(result).toEqual([
      { type: "code", content: "hello\n", language: "text" },
    ]);
  });

  it("テキスト + コードブロック + テキストを正しく分割する", () => {
    const input = "説明文\n\n```js\nconsole.log('hi');\n```\n\n後続テキスト";
    const result = parseMarkdown(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "text", content: "説明文\n\n" });
    expect(result[1]).toEqual({ type: "code", content: "console.log('hi');\n", language: "js" });
    expect(result[2]).toEqual({ type: "text", content: "\n\n後続テキスト" });
  });

  it("複数のコードブロックを正しく分割する", () => {
    const input = "```ts\nconst a = 1;\n```\nと\n```py\nprint('hello')\n```";
    const result = parseMarkdown(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "code", content: "const a = 1;\n", language: "ts" });
    expect(result[1]).toEqual({ type: "text", content: "\nと\n" });
    expect(result[2]).toEqual({ type: "code", content: "print('hello')\n", language: "py" });
  });

  it("コードブロックを含まない複数行テキストはテキストセグメント1つを返す", () => {
    const input = "行1\n行2\n行3";
    const result = parseMarkdown(input);
    expect(result).toEqual([{ type: "text", content: "行1\n行2\n行3" }]);
  });
});
