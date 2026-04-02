import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type ProviderType = "anthropic" | "openai-compatible";

export interface AppConfig {
  provider: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  headers?: Record<string, string>;
  toolUse?: boolean;
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
