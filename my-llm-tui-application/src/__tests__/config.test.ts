import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  resolveEnvVars,
  loadConfigFromFile,
  loadConfig,
} from "../config/config.ts";

// ========================================================
// resolveEnvVars
// ========================================================

describe("resolveEnvVars", () => {
  it("環境変数参照 ${VAR} を実際の値に展開すること", () => {
    process.env["TEST_VAR_RESOLVE"] = "hello";
    expect(resolveEnvVars("${TEST_VAR_RESOLVE}")).toBe("hello");
    delete process.env["TEST_VAR_RESOLVE"];
  });

  it("存在しない環境変数は空文字に展開すること", () => {
    expect(resolveEnvVars("${NONEXISTENT_VAR_XYZ_999}")).toBe("");
  });

  it("環境変数参照を含まない文字列はそのまま返すこと", () => {
    expect(resolveEnvVars("plain-value")).toBe("plain-value");
  });

  it("複数の環境変数参照を展開すること", () => {
    process.env["VAR_A_TEST"] = "foo";
    process.env["VAR_B_TEST"] = "bar";
    expect(resolveEnvVars("${VAR_A_TEST}/${VAR_B_TEST}")).toBe("foo/bar");
    delete process.env["VAR_A_TEST"];
    delete process.env["VAR_B_TEST"];
  });
});

// ========================================================
// loadConfigFromFile
// ========================================================

describe("loadConfigFromFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "llm-tui-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("config.json を読み込んでパースすること", () => {
    const configPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        provider: "openai-compatible",
        baseUrl: "https://example.com",
        model: "my-model",
        apiKey: "test-key",
        toolUse: false,
      })
    );

    const config = loadConfigFromFile(configPath);
    expect(config.provider).toBe("openai-compatible");
    expect(config.model).toBe("my-model");
    expect(config.baseUrl).toBe("https://example.com");
    expect(config.apiKey).toBe("test-key");
    expect(config.toolUse).toBe(false);
  });

  it("apiKey の環境変数参照を展開すること", () => {
    process.env["MY_API_KEY_TEST"] = "secret-key-value";

    const configPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        apiKey: "${MY_API_KEY_TEST}",
      })
    );

    const config = loadConfigFromFile(configPath);
    expect(config.apiKey).toBe("secret-key-value");

    delete process.env["MY_API_KEY_TEST"];
  });

  it("headers 内の環境変数参照を展開すること", () => {
    process.env["AUTH_TOKEN_TEST"] = "token-xyz";

    const configPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        headers: {
          Authorization: "Bearer ${AUTH_TOKEN_TEST}",
        },
      })
    );

    const config = loadConfigFromFile(configPath);
    expect(config.headers?.["Authorization"]).toBe("Bearer token-xyz");

    delete process.env["AUTH_TOKEN_TEST"];
  });

  it("headers なしの設定ファイルを読み込めること", () => {
    const configPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      })
    );

    const config = loadConfigFromFile(configPath);
    expect(config.headers).toBeUndefined();
  });
});

// ========================================================
// loadConfig（デフォルト設定のフォールバック）
// ========================================================

describe("loadConfig", () => {
  it("設定ファイルが存在しない場合はデフォルト設定を返すこと", () => {
    // 実際のホームや cwd に config.json がないことを前提にする
    // テスト環境では通常存在しないので、デフォルトが返る
    // 万が一存在する場合はこのテストはスキップされることがある
    const homedir = os.homedir();
    const xdgConfigPath = path.join(homedir, ".config", "llm-tui", "config.json");
    const cwdConfigPath = path.join(process.cwd(), "config.json");

    if (fs.existsSync(xdgConfigPath) || fs.existsSync(cwdConfigPath)) {
      // 設定ファイルが存在する環境ではこのテストは検証をスキップ
      return;
    }

    const config = loadConfig();
    expect(config.provider).toBe("anthropic");
    expect(config.model).toBe("claude-sonnet-4-20250514");
  });
});
