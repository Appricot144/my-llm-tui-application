import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig } from "../config/config.ts";
import type {
  LLMProvider,
  LLMRequestParams,
  MessageParam,
  NormalizedContentBlock,
  NormalizedResponse,
} from "./types.ts";

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  readonly supportsTools: boolean;

  constructor(config: AppConfig) {
    // anthropic プロバイダーでは SDK が認証ヘッダーを管理するため
    // config.headers は渡さない（openai-compatible / bedrock-compatible 向けの設定を無視する）
    this.client = new Anthropic({
      ...(config.apiKey && { apiKey: config.apiKey }),
      ...(config.baseUrl && { baseURL: config.baseUrl }),
    });
    this.supportsTools = config.toolUse ?? true;
  }

  async streamMessage(
    params: LLMRequestParams,
    onTextDelta: (fullText: string) => void
  ): Promise<NormalizedResponse> {
    const requestParams: Anthropic.Messages.MessageStreamParams = {
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: toAnthropicMessages(params.messages),
    };
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
