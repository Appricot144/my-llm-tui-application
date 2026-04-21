import { describe, it, expect } from "vitest";
import { MARKDOWN_TABLE_OPTIONS } from "../utils/markdownTableOptions.ts";

describe("MARKDOWN_TABLE_OPTIONS", () => {
  describe("レイアウト設定", () => {
    it("widthMode が 'full' である", () => {
      expect(MARKDOWN_TABLE_OPTIONS.widthMode).toBe("full");
    });

    it("wrapMode が 'word' である（単語単位で折り返し）", () => {
      expect(MARKDOWN_TABLE_OPTIONS.wrapMode).toBe("word");
    });

    it("cellPadding が 1 である", () => {
      expect(MARKDOWN_TABLE_OPTIONS.cellPadding).toBe(1);
    });
  });

  describe("罫線設定", () => {
    it("borders が true である（内側の罫線を表示）", () => {
      expect(MARKDOWN_TABLE_OPTIONS.borders).toBe(true);
    });

    it("outerBorder が true である（外側の罫線を表示）", () => {
      expect(MARKDOWN_TABLE_OPTIONS.outerBorder).toBe(true);
    });

    it("borderStyle が 'single' である", () => {
      expect(MARKDOWN_TABLE_OPTIONS.borderStyle).toBe("single");
    });
  });

  describe("オブジェクト構造", () => {
    it("6つのプロパティを持つ", () => {
      expect(Object.keys(MARKDOWN_TABLE_OPTIONS)).toHaveLength(6);
    });

    it("必須プロパティが全て定義されている", () => {
      const keys = ["widthMode", "wrapMode", "cellPadding", "borders", "outerBorder", "borderStyle"];
      for (const key of keys) {
        expect(MARKDOWN_TABLE_OPTIONS).toHaveProperty(key);
      }
    });
  });
});
