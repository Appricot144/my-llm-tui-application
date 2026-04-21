import { describe, it, expect } from "vitest";
import { SYNTAX_STYLE_DEFINITIONS } from "../utils/syntaxStyleDefinitions.ts";
import type { ThemeTokenStyle } from "@opentui/core";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const REQUIRED_SCOPES = [
  "markup.heading",
  "markup.heading.1",
  "markup.heading.2",
  "markup.heading.3",
  "markup.bold",
  "markup.italic",
  "markup.raw",
  "markup.rule",
  "keyword",
  "string",
  "number",
  "comment",
  "function",
  "type",
];

function findStyle(scope: string): ThemeTokenStyle["style"] | undefined {
  return SYNTAX_STYLE_DEFINITIONS.find((e) => e.scope.includes(scope))?.style;
}

describe("SYNTAX_STYLE_DEFINITIONS", () => {
  describe("スコープの網羅性", () => {
    it("全14エントリが定義されている", () => {
      expect(SYNTAX_STYLE_DEFINITIONS).toHaveLength(14);
    });

    it.each(REQUIRED_SCOPES)('"%s" スコープが存在する', (scope) => {
      expect(findStyle(scope)).toBeDefined();
    });
  });

  describe("色コードの正しさ（旧 syntaxHighlight.ts からの継承）", () => {
    it("keyword は紫 (#c586c0) である", () => {
      expect(findStyle("keyword")?.foreground).toBe("#c586c0");
    });

    it("string は橙 (#ce9178) である", () => {
      expect(findStyle("string")?.foreground).toBe("#ce9178");
    });

    it("number は薄緑 (#b5cea8) である", () => {
      expect(findStyle("number")?.foreground).toBe("#b5cea8");
    });

    it("comment は緑 (#6a9955) である", () => {
      expect(findStyle("comment")?.foreground).toBe("#6a9955");
    });

    it("function は黄 (#dcdcaa) である", () => {
      expect(findStyle("function")?.foreground).toBe("#dcdcaa");
    });

    it("type は水色 (#4ec9b0) である", () => {
      expect(findStyle("type")?.foreground).toBe("#4ec9b0");
    });
  });

  describe("Markdown スタイルの正しさ", () => {
    it("markup.heading は bold: true を持つ", () => {
      expect(findStyle("markup.heading")?.bold).toBe(true);
    });

    it("markup.heading.1/2/3 はそれぞれ異なる色を持つ", () => {
      const h1 = findStyle("markup.heading.1")?.foreground;
      const h2 = findStyle("markup.heading.2")?.foreground;
      const h3 = findStyle("markup.heading.3")?.foreground;
      expect(h1).not.toBe(h2);
      expect(h2).not.toBe(h3);
      expect(h1).not.toBe(h3);
    });

    it("markup.bold は bold: true を持つ", () => {
      expect(findStyle("markup.bold")?.bold).toBe(true);
    });

    it("markup.italic は italic: true を持つ", () => {
      expect(findStyle("markup.italic")?.italic).toBe(true);
    });

    it("markup.rule は dim: true を持つ", () => {
      expect(findStyle("markup.rule")?.dim).toBe(true);
    });

    it("markup.raw は background カラーコードを持つ（インラインコード背景色）", () => {
      const style = findStyle("markup.raw");
      expect(style?.background).toBeDefined();
      expect(HEX_COLOR_RE.test(style!.background as string)).toBe(true);
    });
  });

  describe("色コード形式のバリデーション", () => {
    it("foreground を持つ全スタイルのカラーコードが #RRGGBB 形式である", () => {
      for (const entry of SYNTAX_STYLE_DEFINITIONS) {
        if (entry.style.foreground !== undefined) {
          const color = entry.style.foreground as string;
          expect(
            HEX_COLOR_RE.test(color),
            `scope "${entry.scope[0]}" foreground "${color}" is not a valid #RRGGBB color`,
          ).toBe(true);
        }
      }
    });

    it("background を持つ全スタイルのカラーコードが #RRGGBB 形式である", () => {
      for (const entry of SYNTAX_STYLE_DEFINITIONS) {
        if (entry.style.background !== undefined) {
          const color = entry.style.background as string;
          expect(
            HEX_COLOR_RE.test(color),
            `scope "${entry.scope[0]}" background "${color}" is not a valid #RRGGBB color`,
          ).toBe(true);
        }
      }
    });
  });

  describe("属性の排他性・一貫性", () => {
    it("markup.bold は foreground を持たない（装飾のみ）", () => {
      expect(findStyle("markup.bold")?.foreground).toBeUndefined();
    });

    it("markup.italic は foreground を持たない（装飾のみ）", () => {
      expect(findStyle("markup.italic")?.foreground).toBeUndefined();
    });
  });
});
