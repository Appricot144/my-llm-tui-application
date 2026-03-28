import { describe, it, expect } from "vitest";
import { isPrintableCharacter } from "../utils/inputHelper.ts";

describe("isPrintableCharacter", () => {
  it("ASCII英数字を印字可能と判定すること", () => {
    expect(isPrintableCharacter("a")).toBe(true);
    expect(isPrintableCharacter("Z")).toBe(true);
    expect(isPrintableCharacter("5")).toBe(true);
  });

  it("ASCII記号を印字可能と判定すること", () => {
    expect(isPrintableCharacter("!")).toBe(true);
    expect(isPrintableCharacter("@")).toBe(true);
    expect(isPrintableCharacter(" ")).toBe(true);
  });

  it("日本語ひらがなを印字可能と判定すること", () => {
    expect(isPrintableCharacter("あ")).toBe(true);
    expect(isPrintableCharacter("ん")).toBe(true);
  });

  it("日本語カタカナを印字可能と判定すること", () => {
    expect(isPrintableCharacter("ア")).toBe(true);
    expect(isPrintableCharacter("ン")).toBe(true);
  });

  it("日本語漢字を印字可能と判定すること", () => {
    expect(isPrintableCharacter("漢")).toBe(true);
    expect(isPrintableCharacter("字")).toBe(true);
  });

  it("全角記号を印字可能と判定すること", () => {
    expect(isPrintableCharacter("。")).toBe(true);
    expect(isPrintableCharacter("、")).toBe(true);
    expect(isPrintableCharacter("ー")).toBe(true);
  });

  it("制御文字を印字不可と判定すること", () => {
    expect(isPrintableCharacter("\x00")).toBe(false);
    expect(isPrintableCharacter("\x1B")).toBe(false);
    expect(isPrintableCharacter("\r")).toBe(false);
    expect(isPrintableCharacter("\n")).toBe(false);
  });

  it("空文字列を印字不可と判定すること", () => {
    expect(isPrintableCharacter("")).toBe(false);
  });

  it("複数文字の文字列を印字不可と判定すること", () => {
    expect(isPrintableCharacter("ab")).toBe(false);
    expect(isPrintableCharacter("あい")).toBe(false);
  });

  it("絵文字を印字可能と判定すること", () => {
    expect(isPrintableCharacter("😀")).toBe(true);
  });
});
