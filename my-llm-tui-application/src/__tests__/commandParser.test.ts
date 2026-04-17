import { describe, it, expect } from "vitest";
import { parseCommand, isCommandInput } from "../utils/commandParser.ts";

describe("parseCommand", () => {
  it("/ + 英字コマンドを解析できる", () => {
    const result = parseCommand("/help");
    expect(result).toEqual({ commandName: "help", args: "" });
  });

  it("/ + ハイフン入りコマンドを解析できる", () => {
    const result = parseCommand("/show-history");
    expect(result).toEqual({ commandName: "show-history", args: "" });
  });

  it("/ + 大文字コマンドを解析できる", () => {
    const result = parseCommand("/HELP");
    expect(result).toEqual({ commandName: "HELP", args: "" });
  });

  it("コマンド名の後の引数を返す", () => {
    const result = parseCommand("/search some args here");
    expect(result).toEqual({ commandName: "search", args: "some args here" });
  });

  it("引数の前後の空白をトリムする", () => {
    const result = parseCommand("/search   trimmed  ");
    expect(result).toEqual({ commandName: "search", args: "trimmed" });
  });

  it("/ のみの入力は null を返す", () => {
    expect(parseCommand("/")).toBeNull();
  });

  it("/ + 数字だけは null を返す（コマンド名に数字不可）", () => {
    expect(parseCommand("/123")).toBeNull();
  });

  it("/ なしの通常メッセージは null を返す", () => {
    expect(parseCommand("hello")).toBeNull();
  });

  it("空文字は null を返す", () => {
    expect(parseCommand("")).toBeNull();
  });

  it("途中に / がある文字列は null を返す", () => {
    expect(parseCommand("hello/world")).toBeNull();
  });
});

describe("isCommandInput", () => {
  it("/ で始まる入力は true を返す", () => {
    expect(isCommandInput("/help")).toBe(true);
  });

  it("/ のみは true を返す", () => {
    expect(isCommandInput("/")).toBe(true);
  });

  it("通常の文字列は false を返す", () => {
    expect(isCommandInput("hello")).toBe(false);
  });

  it("空文字は false を返す", () => {
    expect(isCommandInput("")).toBe(false);
  });

  it("空白で始まる文字列は false を返す", () => {
    expect(isCommandInput(" /help")).toBe(false);
  });
});
