// ========================================================
// プロバイダー非依存のメッセージ型
// ========================================================

export interface TextBlockParam {
  type: "text";
  text: string;
}

export interface ToolUseBlockParam {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlockParam {
  type: "tool_result";
  tool_use_id: string;
  content: string | TextBlockParam[];
}

export type ContentBlockParam =
  | TextBlockParam
  | ToolUseBlockParam
  | ToolResultBlockParam;

export interface MessageParam {
  role: "user" | "assistant";
  content: string | ContentBlockParam[];
}

// ========================================================
// ツールスキーマ
// ========================================================

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ========================================================
// プロバイダー共通レスポンス型
// ========================================================

export interface NormalizedTextBlock {
  type: "text";
  text: string;
}

export interface NormalizedToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type NormalizedContentBlock = NormalizedTextBlock | NormalizedToolUseBlock;

export interface NormalizedResponse {
  content: NormalizedContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
  usage: { inputTokens: number; outputTokens: number };
}

// ========================================================
// プロバイダーインターフェース
// ========================================================

export interface LLMRequestParams {
  model: string;
  maxTokens: number;
  system: string;
  messages: MessageParam[];
  tools?: ToolSchema[];
}

export interface LLMProvider {
  streamMessage(
    params: LLMRequestParams,
    onTextDelta: (fullText: string) => void
  ): Promise<NormalizedResponse>;
  readonly supportsTools: boolean;
}
