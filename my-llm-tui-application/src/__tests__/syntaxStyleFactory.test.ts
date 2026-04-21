import { describe, it, expect } from "vitest";
import { SYNTAX_STYLE_DEFINITIONS } from "../utils/syntaxStyleDefinitions.ts";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const REQUIRED_KEYS = [
  "markup.heading",
  "markup.heading.1",
  "markup.heading.2",
  "markup.heading.3",
  "markup.bold",
  "markup.italic",
  "markup.inline.raw",
  "markup.rule",
  "keyword",
  "string",
  "number",
  "comment",
  "function",
  "type",
];

describe("SYNTAX_STYLE_DEFINITIONS", () => {
  describe("キーの網羅性", () => {
    it("全14キーが定義されている", () => {
      expect(Object.keys(SYNTAX_STYLE_DEFINITIONS)).toHaveLength(14);
    });

    it.each(REQUIRED_KEYS)('"%s" キーが存在する', (key) => {
      expect(SYNTAX_STYLE_DEFINITIONS).toHaveProperty(key);
    });
  });

  describe("色コードの正しさ（旧 syntaxHighlight.ts からの継承）", () => {
    it("keyword は紫 (#c586c0) である", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["keyword"].fg).toBe("#c586c0");
    });

    it("string は橙 (#ce9178) である", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["string"].fg).toBe("#ce9178");
    });

    it("number は薄緑 (#b5cea8) である", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["number"].fg).toBe("#b5cea8");
    });

    it("comment は緑 (#6a9955) である", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["comment"].fg).toBe("#6a9955");
    });

    it("function は黄 (#dcdcaa) である", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["function"].fg).toBe("#dcdcaa");
    });

    it("type は水色 (#4ec9b0) である", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["type"].fg).toBe("#4ec9b0");
    });
  });

  describe("Markdown スタイルの正しさ", () => {
    it("markup.heading は bold: true を持つ", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["markup.heading"].bold).toBe(true);
    });

    it("markup.heading.1/2/3 はそれぞれ異なる色を持つ", () => {
      const h1 = SYNTAX_STYLE_DEFINITIONS["markup.heading.1"]?.fg;
      const h2 = SYNTAX_STYLE_DEFINITIONS["markup.heading.2"]?.fg;
      const h3 = SYNTAX_STYLE_DEFINITIONS["markup.heading.3"]?.fg;
      expect(h1).not.toBe(h2);
      expect(h2).not.toBe(h3);
      expect(h1).not.toBe(h3);
    });

    it("markup.bold は bold: true を持つ", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["markup.bold"]?.bold).toBe(true);
    });

    it("markup.italic は italic: true を持つ", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["markup.italic"]?.italic).toBe(true);
    });

    it("markup.rule は dim: true を持つ", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["markup.rule"]?.dim).toBe(true);
    });

    it("markup.inline.raw は bg カラーコードを持つ（インラインコード背景色）", () => {
      const style = SYNTAX_STYLE_DEFINITIONS["markup.inline.raw"];
      expect(style.bg).toBeDefined();
      expect(HEX_COLOR_RE.test(style.bg!)).toBe(true);
    });
  });

  describe("色コード形式のバリデーション", () => {
    it("fg を持つ全スタイルのカラーコードが #RRGGBB 形式である", () => {
      for (const [key, style] of Object.entries(SYNTAX_STYLE_DEFINITIONS)) {
        if (style.fg !== undefined) {
          expect(
            HEX_COLOR_RE.test(style.fg),
            `${key}.fg "${style.fg}" is not a valid #RRGGBB color`
          ).toBe(true);
        }
      }
    });

    it("bg を持つ全スタイルのカラーコードが #RRGGBB 形式である", () => {
      for (const [key, style] of Object.entries(SYNTAX_STYLE_DEFINITIONS)) {
        if (style.bg !== undefined) {
          expect(
            HEX_COLOR_RE.test(style.bg),
            `${key}.bg "${style.bg}" is not a valid #RRGGBB color`
          ).toBe(true);
        }
      }
    });
  });

  describe("属性の排他性・一貫性", () => {
    it("markup.bold は fg を持たない（装飾のみ）", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["markup.bold"]?.fg).toBeUndefined();
    });

    it("markup.italic は fg を持たない（装飾のみ）", () => {
      expect(SYNTAX_STYLE_DEFINITIONS["markup.italic"]?.fg).toBeUndefined();
    });
  });
});
