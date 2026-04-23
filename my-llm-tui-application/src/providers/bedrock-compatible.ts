import type { AppConfig } from "../config/config.ts";
import type {
  LLMProvider,
  LLMRequestParams,
  NormalizedContentBlock,
  NormalizedResponse,
} from "./types.ts";

// ========================================================
// Bedrock リクエスト型定義
// ========================================================

interface BedrockSystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

interface BedrockRequestBody {
  anthropic_version: "bedrock-2023-05-31";
  max_tokens: number;
  messages: unknown[];
  system?: string | BedrockSystemBlock[];
  tools?: unknown[];
}

function modelSupportsPromptCaching(model: string): boolean {
  return /^claude-3/.test(model) || /^claude-(sonnet|opus|haiku)-[4-9]/.test(model);
}

// ========================================================
// Anthropic SSE イベント型定義
// ========================================================

interface MessageStartEvent {
  type: "message_start";
  message: { usage: { input_tokens: number } };
}

interface ContentBlockStartEvent {
  type: "content_block_start";
  index: number;
  content_block:
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string };
}

interface ContentBlockDeltaEvent {
  type: "content_block_delta";
  index: number;
  delta:
    | { type: "text_delta"; text: string }
    | { type: "input_json_delta"; partial_json: string };
}

interface MessageDeltaEvent {
  type: "message_delta";
  delta: { stop_reason: string };
  usage: { output_tokens: number };
}

type AnthropicSSEEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | MessageDeltaEvent
  | { type: string };

// ========================================================
// Bedrock JSON レスポンス型定義
// ========================================================

interface BedrockJsonResponse {
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  >;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

// ========================================================
// プロバイダー本体
// ========================================================

export class BedrockCompatibleProvider implements LLMProvider {
  private baseUrl: string;
  private headers: Record<string, string>;
  readonly supportsTools: boolean;
  readonly supportsPromptCaching: boolean;

  constructor(config: AppConfig) {
    if (!config.baseUrl) {
      throw new Error("bedrock-compatible プロバイダーには baseUrl が必要です");
    }
    this.baseUrl = config.baseUrl;
    this.headers = config.headers ?? {};
    this.supportsTools = config.toolUse ?? true;
    this.supportsPromptCaching = modelSupportsPromptCaching(config.model);
  }

  async streamMessage(
    params: LLMRequestParams,
    onTextDelta: (fullText: string) => void
  ): Promise<NormalizedResponse> {
    const body: BedrockRequestBody = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: params.maxTokens,
      messages: params.messages as unknown[],
    };
    if (params.system) {
      if (this.supportsPromptCaching) {
        body.system = [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }];
      } else {
        body.system = params.system;
      }
    }
    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools;
    }

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error("レスポンスボディが空です");
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      return parseAnthropicSSEStream(response.body, onTextDelta);
    } else {
      return parseJsonResponse(response, onTextDelta);
    }
  }
}

// ========================================================
// Anthropic SSE ストリームパーサー
// ========================================================

export async function parseAnthropicSSEStream(
  body: ReadableStream<Uint8Array>,
  onTextDelta: (fullText: string) => void
): Promise<NormalizedResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let stopReason: NormalizedResponse["stopReason"] = "end_turn";
  let inputTokens = 0;
  let outputTokens = 0;

  const toolBlocks = new Map<
    number,
    { id: string; name: string; inputJson: string }
  >();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;

        let event: AnthropicSSEEvent;
        try {
          event = JSON.parse(data) as AnthropicSSEEvent;
        } catch {
          continue;
        }

        if (event.type === "message_start") {
          const e = event as MessageStartEvent;
          inputTokens = e.message.usage.input_tokens;
        } else if (event.type === "content_block_start") {
          const e = event as ContentBlockStartEvent;
          if (e.content_block.type === "tool_use") {
            toolBlocks.set(e.index, {
              id: e.content_block.id,
              name: e.content_block.name,
              inputJson: "",
            });
          }
        } else if (event.type === "content_block_delta") {
          const e = event as ContentBlockDeltaEvent;
          if (e.delta.type === "text_delta") {
            fullText += e.delta.text;
            onTextDelta(fullText);
          } else if (e.delta.type === "input_json_delta") {
            const tool = toolBlocks.get(e.index);
            if (tool) {
              tool.inputJson += e.delta.partial_json;
            }
          }
        } else if (event.type === "message_delta") {
          const e = event as MessageDeltaEvent;
          stopReason = mapStopReason(e.delta.stop_reason);
          outputTokens = e.usage.output_tokens;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const content: NormalizedContentBlock[] = [];
  if (fullText) {
    content.push({ type: "text", text: fullText });
  }
  for (const [, tool] of toolBlocks) {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(tool.inputJson) as Record<string, unknown>;
    } catch {
      // incomplete JSON
    }
    content.push({ type: "tool_use", id: tool.id, name: tool.name, input });
  }

  return {
    content,
    stopReason,
    usage: { inputTokens, outputTokens },
  };
}

// ========================================================
// JSON レスポンスパーサー（non-streaming）
// ========================================================

export async function parseJsonResponse(
  response: Response,
  onTextDelta: (fullText: string) => void
): Promise<NormalizedResponse> {
  const json = (await response.json()) as BedrockJsonResponse;

  const content: NormalizedContentBlock[] = json.content.map((block) => {
    if (block.type === "text") {
      return { type: "text" as const, text: block.text };
    }
    return {
      type: "tool_use" as const,
      id: block.id,
      name: block.name,
      input: block.input,
    };
  });

  const fullText = content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (fullText) {
    onTextDelta(fullText);
  }

  return {
    content,
    stopReason: mapStopReason(json.stop_reason),
    usage: {
      inputTokens: json.usage.input_tokens,
      outputTokens: json.usage.output_tokens,
    },
  };
}

// ========================================================
// ヘルパー
// ========================================================

function mapStopReason(reason: string): NormalizedResponse["stopReason"] {
  switch (reason) {
    case "tool_use":
      return "tool_use";
    case "max_tokens":
      return "max_tokens";
    default:
      return "end_turn";
  }
}
