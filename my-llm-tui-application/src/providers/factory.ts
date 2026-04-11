import type { AppConfig } from "../config/config.ts";
import type { LLMProvider } from "./types.ts";
import { AnthropicProvider } from "./anthropic.ts";
import { OpenAICompatibleProvider } from "./openai-compatible.ts";
import { BedrockCompatibleProvider } from "./bedrock-compatible.ts";

export function createProvider(config: AppConfig): LLMProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "openai-compatible":
      return new OpenAICompatibleProvider(config);
    case "bedrock-compatible":
      return new BedrockCompatibleProvider(config);
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`未対応のプロバイダー: ${_exhaustive}`);
    }
  }
}
