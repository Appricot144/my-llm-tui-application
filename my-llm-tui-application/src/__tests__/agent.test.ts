import { describe, it, expect } from "vitest";
import { buildCacheKey } from "../agent/agent.ts";

describe("buildCacheKey", () => {
  describe("read_file", () => {
    it("path のみ指定した場合のキーを返す", () => {
      const key = buildCacheKey("read_file", { path: "src/index.ts" });
      expect(key).toBe("read_file:src/index.ts::");
    });

    it("start_line / end_line を含むキーを返す", () => {
      const key = buildCacheKey("read_file", { path: "src/index.ts", start_line: 10, end_line: 50 });
      expect(key).toBe("read_file:src/index.ts:10:50");
    });

    it("start_line のみ指定した場合は end_line を空文字にする", () => {
      const key = buildCacheKey("read_file", { path: "src/index.ts", start_line: 5 });
      expect(key).toBe("read_file:src/index.ts:5:");
    });

    it("同じ引数には同じキーを返す", () => {
      const a = buildCacheKey("read_file", { path: "foo.ts", start_line: 1, end_line: 100 });
      const b = buildCacheKey("read_file", { path: "foo.ts", start_line: 1, end_line: 100 });
      expect(a).toBe(b);
    });

    it("異なるパスには異なるキーを返す", () => {
      const a = buildCacheKey("read_file", { path: "a.ts" });
      const b = buildCacheKey("read_file", { path: "b.ts" });
      expect(a).not.toBe(b);
    });

    it("異なる行範囲には異なるキーを返す", () => {
      const a = buildCacheKey("read_file", { path: "foo.ts", start_line: 1, end_line: 50 });
      const b = buildCacheKey("read_file", { path: "foo.ts", start_line: 51, end_line: 100 });
      expect(a).not.toBe(b);
    });
  });

  describe("list_directory", () => {
    it("path 指定時のキーを返す", () => {
      const key = buildCacheKey("list_directory", { path: "src" });
      expect(key).toBe("list_directory:src");
    });

    it("path 省略時は '.' をデフォルトにする", () => {
      const key = buildCacheKey("list_directory", {});
      expect(key).toBe("list_directory:.");
    });
  });

  describe("search_code", () => {
    it("pattern と path を含むキーを返す", () => {
      const key = buildCacheKey("search_code", { pattern: "function foo", path: "src" });
      expect(key).toBe("search_code:function foo:src");
    });

    it("path 省略時は '.' をデフォルトにする", () => {
      const key = buildCacheKey("search_code", { pattern: "TODO" });
      expect(key).toBe("search_code:TODO:.");
    });

    it("異なるパターンには異なるキーを返す", () => {
      const a = buildCacheKey("search_code", { pattern: "foo" });
      const b = buildCacheKey("search_code", { pattern: "bar" });
      expect(a).not.toBe(b);
    });
  });

  describe("書き込みツール", () => {
    it("write_file は null を返す", () => {
      expect(buildCacheKey("write_file", { path: "out.ts", content: "x" })).toBeNull();
    });

    it("edit_file は null を返す", () => {
      expect(buildCacheKey("edit_file", { path: "out.ts", start_line: 1, end_line: 1, new_content: "x" })).toBeNull();
    });

    it("create_directory は null を返す", () => {
      expect(buildCacheKey("create_directory", { path: "dir" })).toBeNull();
    });

    it("未知のツール名は null を返す", () => {
      expect(buildCacheKey("unknown_tool", {})).toBeNull();
    });
  });
});
