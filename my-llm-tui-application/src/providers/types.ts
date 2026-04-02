import type Anthropic from "@anthropic-ai/sdk";

export type MessageParam = Anthropic.Messages.MessageParam;

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

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
