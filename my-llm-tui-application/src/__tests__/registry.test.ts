import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerCommand,
  getCommand,
  executeCommand,
  getAllCommands,
  resetRegistry,
} from "../commands/registry.ts";

describe("registry", () => {
  beforeEach(() => {
    resetRegistry();
  });

  describe("registerCommand / getCommand", () => {
    it("コマンドを登録して取得できる", () => {
      const handler = vi.fn();
      registerCommand({ name: "help", description: "ヘルプ", handler });

      const cmd = getCommand("help");
      expect(cmd).toBeDefined();
      expect(cmd!.name).toBe("help");
      expect(cmd!.description).toBe("ヘルプ");
    });

    it("未登録のコマンドは undefined を返す", () => {
      expect(getCommand("unknown")).toBeUndefined();
    });

    it("同名で再登録すると上書きされる", () => {
      const first = vi.fn();
      const second = vi.fn();
      registerCommand({ name: "cmd", description: "first", handler: first });
      registerCommand({ name: "cmd", description: "second", handler: second });

      expect(getCommand("cmd")!.description).toBe("second");
    });
  });

  describe("executeCommand", () => {
    it("登録済みコマンドを実行して true を返す", () => {
      const handler = vi.fn();
      registerCommand({ name: "run", description: "", handler });

      const result = executeCommand("run", "");
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledOnce();
    });

    it("引数をハンドラーに渡す", () => {
      const handler = vi.fn();
      registerCommand({ name: "search", description: "", handler });

      executeCommand("search", "foo bar");
      expect(handler).toHaveBeenCalledWith("foo bar");
    });

    it("未知のコマンドは false を返す", () => {
      const result = executeCommand("unknown", "");
      expect(result).toBe(false);
    });

    it("未知のコマンドはハンドラーを呼ばない", () => {
      const handler = vi.fn();
      registerCommand({ name: "registered", description: "", handler });

      executeCommand("other", "");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("getAllCommands", () => {
    it("登録済みコマンドをすべて返す", () => {
      registerCommand({ name: "a", description: "", handler: vi.fn() });
      registerCommand({ name: "b", description: "", handler: vi.fn() });

      const all = getAllCommands();
      expect(all).toHaveLength(2);
      expect(all.map((c) => c.name)).toContain("a");
      expect(all.map((c) => c.name)).toContain("b");
    });

    it("レジストリが空のときは空配列を返す", () => {
      expect(getAllCommands()).toEqual([]);
    });
  });
});
