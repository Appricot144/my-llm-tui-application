import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig } from "../config/config.ts";
import type {
  LLMProvider,
  LLMRequestParams,
  MessageParam,
  NormalizedContentBlock,
  NormalizedResponse,
} from "./types.ts";

/**
 * Claude 3 以降の直接 API モデルはプロンプトキャッシングをサポートする。
 * claude-2.x / claude-instant は非対応。
 */
export function modelSupportsPromptCaching(model: string): boolean {
  return /^claude-3/.test(model) || /^claude-(sonnet|opus|haiku)-[4-9]/.test(model);
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  readonly supportsTools: boolean;
  readonly supportsPromptCaching: boolean;

  constructor(config: AppConfig) {
    // anthropic プロバイダーでは SDK が認証ヘッダーを管理するため
    // config.headers は渡さない（openai-compatible / bedrock-compatible 向けの設定を無視する）
    this.client = new Anthropic({
      ...(config.apiKey && { apiKey: config.apiKey }),
      ...(config.baseUrl && { baseURL: config.baseUrl }),
    });
    this.supportsTools = config.toolUse ?? true;
    this.supportsPromptCaching = modelSupportsPromptCaching(config.model);
  }

  async streamMessage(
    params: LLMRequestParams,
    onTextDelta: (fullText: string) => void
  ): Promise<NormalizedResponse> {
    const requestParams: Anthropic.Messages.MessageStreamParams = {
      model: params.model,
      max_tokens: params.maxTokens,
      messages: toAnthropicMessages(params.messages),
    };
    if (Array.isArray(params.system)) {
      if (params.system.length > 0) {
        requestParams.system = params.system as unknown as Anthropic.Messages.TextBlockParam[];
      }
    } else if (params.system) {
      if (this.supportsPromptCaching) {
        requestParams.system = [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }];
      } else {
        requestParams.system = params.system;
      }
    }
    if (params.tools && params.tools.length > 0) {
      requestParams.tools = params.tools as unknown as Anthropic.Messages.Tool[];
    }

    const stream = this.client.messages.stream(requestParams);

    let currentText = "";
    stream.on("text", (text) => {
      currentText += text;
      onTextDelta(currentText);
    });

    const response = await stream.finalMessage();

    return {
      content: response.content as unknown as NormalizedContentBlock[],
      stopReason: mapStopReason(response.stop_reason),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}

/**
 * 独自の MessageParam を Anthropic SDK の MessageParam に変換する。
 * 両者は構造的に互換性があるため、型キャストで対応する。
 * Anthropic 固有のブロック型（image など）は本アプリでは使用しない。
 */
function toAnthropicMessages(
  messages: MessageParam[]
): Anthropic.Messages.MessageParam[] {
  return messages as unknown as Anthropic.Messages.MessageParam[];
}

function mapStopReason(
  reason: string | null
): NormalizedResponse["stopReason"] {
  switch (reason) {
    case "tool_use":
      return "tool_use";
    case "max_tokens":
      return "max_tokens";
    default:
      return "end_turn";
  }
}
