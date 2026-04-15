import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  setRoot,
  setSecurityConfig,
  validatePath,
  resetSecurity,
} from "../security/security.ts";

function createTempDir(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "security-test-"));
  fs.mkdirSync(path.join(tmpDir, "src"));
  fs.mkdirSync(path.join(tmpDir, "tests"));
  fs.mkdirSync(path.join(tmpDir, "secrets"));
  fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=value");
  fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "");
  fs.writeFileSync(path.join(tmpDir, "tests", "foo.test.ts"), "");
  fs.writeFileSync(path.join(tmpDir, "secrets", "key.pem"), "");
  return tmpDir;
}

describe("security", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    resetSecurity();
    setRoot(tmpDir);
    setSecurityConfig({});
  });

  // ========================================================
  // setRoot / 基本チェック
  // ========================================================

  describe("setRoot が未設定の場合", () => {
    it("validatePath が エラーを投げること", () => {
      resetSecurity();
      expect(() => validatePath("src")).toThrow("setRoot() が呼ばれていません");
    });
  });

  // ========================================================
  // パストラバーサル防止
  // ========================================================

  describe("パストラバーサル防止", () => {
    it("許可ルート内のパスを返すこと", () => {
      const result = validatePath("src/index.ts");
      expect(result).toBe(path.join(tmpDir, "src", "index.ts"));
    });

    it("ルートディレクトリ自体を許可すること", () => {
      const result = validatePath(".");
      expect(result).toBe(tmpDir);
    });

    it("'../' によるパストラバーサルを拒否すること", () => {
      expect(() => validatePath("../../etc/passwd")).toThrow("許可されたディレクトリ外");
    });

    it("絶対パスでルート外を拒否すること", () => {
      expect(() => validatePath("/etc/passwd")).toThrow("許可されたディレクトリ外");
    });
  });

  // ========================================================
  // denylist
  // ========================================================

  describe("denylist", () => {
    it("denylist に一致するパスを拒否すること", () => {
      setSecurityConfig({ denylist: [".env"] });
      expect(() => validatePath(".env")).toThrow("denylist に含まれています");
    });

    it("denylist ディレクトリ配下のパスを拒否すること", () => {
      setSecurityConfig({ denylist: ["secrets"] });
      expect(() => validatePath("secrets/key.pem")).toThrow("denylist に含まれています");
    });

    it("denylist に一致しないパスは通過すること", () => {
      setSecurityConfig({ denylist: ["secrets"] });
      const result = validatePath("src/index.ts");
      expect(result).toBe(path.join(tmpDir, "src", "index.ts"));
    });

    it("denylist が空の場合はすべて通過すること", () => {
      setSecurityConfig({ denylist: [] });
      expect(() => validatePath("src/index.ts")).not.toThrow();
    });

    it("複数の denylist エントリが機能すること", () => {
      setSecurityConfig({ denylist: [".env", "secrets"] });
      expect(() => validatePath(".env")).toThrow("denylist に含まれています");
      expect(() => validatePath("secrets/key.pem")).toThrow("denylist に含まれています");
      expect(() => validatePath("src/index.ts")).not.toThrow();
    });
  });

  // ========================================================
  // allowlist
  // ========================================================

  describe("allowlist", () => {
    it("allowlist に含まれるパスを許可すること", () => {
      setSecurityConfig({ allowlist: ["src"] });
      const result = validatePath("src/index.ts");
      expect(result).toBe(path.join(tmpDir, "src", "index.ts"));
    });

    it("allowlist 外のパスを拒否すること", () => {
      setSecurityConfig({ allowlist: ["src"] });
      expect(() => validatePath("tests/foo.test.ts")).toThrow("allowlist 外です");
    });

    it("allowlist が空の場合はすべて通過すること（省略と同じ）", () => {
      setSecurityConfig({ allowlist: [] });
      expect(() => validatePath("tests/foo.test.ts")).not.toThrow();
    });

    it("複数の allowlist エントリが機能すること", () => {
      setSecurityConfig({ allowlist: ["src", "tests"] });
      expect(() => validatePath("src/index.ts")).not.toThrow();
      expect(() => validatePath("tests/foo.test.ts")).not.toThrow();
      expect(() => validatePath("secrets/key.pem")).toThrow("allowlist 外です");
    });
  });

  // ========================================================
  // denylist と allowlist の組み合わせ
  // ========================================================

  describe("denylist と allowlist の組み合わせ", () => {
    it("denylist が allowlist より優先されること", () => {
      setSecurityConfig({ allowlist: ["src"], denylist: ["src"] });
      // src は allowlist に含まれるが denylist にも含まれるので拒否
      expect(() => validatePath("src/index.ts")).toThrow("denylist に含まれています");
    });
  });
});
