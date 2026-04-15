import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type ProviderType = "anthropic" | "openai-compatible" | "bedrock-compatible";

export interface SecurityConfig {
  /** allowedRoot からの相対パスプレフィックス。一致したらアクセス拒否（denylist が allowlist より優先） */
  denylist?: string[];
  /** 指定がある場合、このリストに含まれるパスのみ許可（省略時は全許可） */
  allowlist?: string[];
}

export interface AppConfig {
  provider: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  headers?: Record<string, string>;
  toolUse?: boolean;
  security?: SecurityConfig;
}

const DEFAULT_CONFIG: AppConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
};

const CONFIG_SEARCH_PATHS = [
  path.join(os.homedir(), ".config", "llm-tui", "config.json"),
  path.join(process.cwd(), "config.json"),
];

export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName: string) => {
    return process.env[varName] ?? "";
  });
}

function resolveConfigValues(config: AppConfig): AppConfig {
  const resolved: AppConfig = { ...config };
  if (resolved.apiKey) {
    resolved.apiKey = resolveEnvVars(resolved.apiKey);
  }
  if (resolved.headers) {
    resolved.headers = Object.fromEntries(
      Object.entries(resolved.headers).map(([k, v]) => [k, resolveEnvVars(v)])
    );
  }
  return resolved;
}

export function loadConfigFromFile(filePath: string): AppConfig {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as AppConfig;
  return resolveConfigValues(parsed);
}

export function loadConfig(): AppConfig {
  for (const configPath of CONFIG_SEARCH_PATHS) {
    if (fs.existsSync(configPath)) {
      return loadConfigFromFile(configPath);
    }
  }
  return { ...DEFAULT_CONFIG };
}
