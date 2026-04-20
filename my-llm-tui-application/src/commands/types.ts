import type { LLMProvider } from "../providers/types.ts";
import type { SecurityConfig } from "../config/config.ts";

/** コマンドハンドラーが必要とする App レベルのコールバック群 */
export interface CommandContext {
  provider: LLMProvider;
  model: string;
  projectRoot: string;
  securityConfig?: SecurityConfig;
  setLoading: (loading: boolean) => void;
  addAssistantMessage: (content: string) => void;
  updateLastAssistantMessage: (content: string) => void;
  updateTokenUsage: (inputTokens: number, outputTokens: number) => void;
}
