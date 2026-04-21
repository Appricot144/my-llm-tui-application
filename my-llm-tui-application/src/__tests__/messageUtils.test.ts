import { describe, it, expect } from "vitest";
import { splitUserMessageLines } from "../utils/messageUtils.ts";

describe("splitUserMessageLines", () => {
  it("単一行テキストは1要素の配列を返す", () => {
    expect(splitUserMessageLines("hello")).toEqual(["hello"]);
  });

  it("空文字列は [''] を返す", () => {
    expect(splitUserMessageLines("")).toEqual([""]);
  });

  it("\\n で2行に分割する", () => {
    expect(splitUserMessageLines("line1\nline2")).toEqual(["line1", "line2"]);
  });

  it("3行以上を正しく分割する", () => {
    expect(splitUserMessageLines("a\nb\nc")).toEqual(["a", "b", "c"]);
  });

  it("末尾の \\n は末尾に空文字要素を生む", () => {
    const result = splitUserMessageLines("hello\n");
    expect(result).toEqual(["hello", ""]);
  });

  it("先頭の \\n は先頭に空文字要素を生む", () => {
    const result = splitUserMessageLines("\nhello");
    expect(result).toEqual(["", "hello"]);
  });

  it("連続する \\n は空文字要素を生む", () => {
    expect(splitUserMessageLines("a\n\nb")).toEqual(["a", "", "b"]);
  });

  it("\\n のみの文字列は2つの空文字要素を返す", () => {
    expect(splitUserMessageLines("\n")).toEqual(["", ""]);
  });

  it("日本語テキストを正しく分割する", () => {
    expect(splitUserMessageLines("こんにちは\n世界")).toEqual(["こんにちは", "世界"]);
  });

  it("コードブロックを含む複数行を正しく分割する", () => {
    const input = "説明\n```ts\nconst x = 1;\n```";
    expect(splitUserMessageLines(input)).toEqual(["説明", "```ts", "const x = 1;", "```"]);
  });
});
