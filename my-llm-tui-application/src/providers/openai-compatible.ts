import type { AppConfig } from "../config/config.ts";
import type {
  LLMProvider,
  LLMRequestParams,
  MessageParam,
  TextBlockParam,
  ToolUseBlockParam,
  ToolResultBlockParam,
  NormalizedContentBlock,
  NormalizedResponse,
  ToolSchema,
} from "./types.ts";

// ========================================================
// OpenAI API の型定義（最低限）
// ========================================================

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

interface OpenAIChunk {
  choices: Array<{
    delta: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

// ========================================================
// プロバイダー本体
// ========================================================

export class OpenAICompatibleProvider implements LLMProvider {
  private baseUrl: string;
  private apiKey: string;
  private headers: Record<string, string>;
  readonly supportsTools: boolean;
  readonly supportsPromptCaching = false;

  constructor(config: AppConfig) {
    if (!config.baseUrl) {
      throw new Error("openai-compatible プロバイダーには baseUrl が必要です");
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey ?? "";
    this.headers = config.headers ?? {};
    this.supportsTools = config.toolUse ?? false;
  }

  async streamMessage(
    params: LLMRequestParams,
    onTextDelta: (fullText: string) => void
  ): Promise<NormalizedResponse> {
    const messages = convertMessages(params.system, params.messages);
    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      max_tokens: params.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (params.tools && params.tools.length > 0) {
      body.tools = convertTools(params.tools);
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
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

    return parseSSEStream(response.body, onTextDelta);
  }
}

// ========================================================
// SSE ストリームパーサー
// ========================================================

async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onTextDelta: (fullText: string) => void
): Promise<NormalizedResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let stopReason: NormalizedResponse["stopReason"] = "end_turn";
  let usage = { inputTokens: 0, outputTokens: 0 };

  // tool_calls はインデックスごとに蓄積
  const toolCallMap = new Map<
    number,
    { id: string; name: string; argumentsStr: string }
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

        let chunk: OpenAIChunk;
        try {
          chunk = JSON.parse(data) as OpenAIChunk;
        } catch {
          continue;
        }

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        if (choice.delta?.content) {
          fullText += choice.delta.content;
          onTextDelta(fullText);
        }

        if (choice.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            if (!toolCallMap.has(tc.index)) {
              toolCallMap.set(tc.index, {
                id: tc.id ?? "",
                name: tc.function?.name ?? "",
                argumentsStr: "",
              });
            }
            const entry = toolCallMap.get(tc.index)!;
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.argumentsStr += tc.function.arguments;
          }
        }

        if (choice.finish_reason) {
          stopReason = mapFinishReason(choice.finish_reason);
        }

        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          };
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
  for (const [, tc] of toolCallMap) {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(tc.argumentsStr) as Record<string, unknown>;
    } catch {
      // arguments が不完全な場合は空オブジェクト
    }
    content.push({ type: "tool_use", id: tc.id, name: tc.name, input });
  }

  return { content, stopReason, usage };
}

function mapFinishReason(
  reason: string
): NormalizedResponse["stopReason"] {
  switch (reason) {
    case "tool_calls":
      return "tool_use";
    case "length":
      return "max_tokens";
    default:
      return "end_turn";
  }
}

// ========================================================
// 独自 MessageParam → OpenAI メッセージ変換
// ========================================================

export function convertMessages(
  system: string,
  messages: MessageParam[]
): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  if (system) {
    result.push({ role: "system", content: system });
  }

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      result.push({ role: msg.role as "user" | "assistant", content: msg.content });
      continue;
    }

    if (!Array.isArray(msg.content)) continue;

    if (msg.role === "user") {
      for (const block of msg.content) {
        if (block.type === "tool_result") {
          const tr = block as ToolResultBlockParam;
          const content =
            typeof tr.content === "string"
              ? tr.content
              : Array.isArray(tr.content)
                ? (tr.content as TextBlockParam[]).map((b) => b.text).join("")
                : "";
          result.push({
            role: "tool",
            tool_call_id: tr.tool_use_id,
            content,
          });
        } else if (block.type === "text") {
          result.push({ role: "user", content: block.text });
        }
      }
    } else if (msg.role === "assistant") {
      const textBlocks = msg.content.filter(
        (b): b is TextBlockParam => b.type === "text"
      );
      const toolUseBlocks = msg.content.filter(
        (b): b is ToolUseBlockParam => b.type === "tool_use"
      );

      const text = textBlocks.map((b) => b.text).join("");

      if (toolUseBlocks.length > 0) {
        result.push({
          role: "assistant",
          content: text || null,
          tool_calls: toolUseBlocks.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.input),
            },
          })),
        });
      } else {
        result.push({ role: "assistant", content: text });
      }
    }
  }

  return result;
}

// ========================================================
// 独自 ToolSchema → OpenAI tools 変換
// ========================================================

export function convertTools(tools: ToolSchema[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}
