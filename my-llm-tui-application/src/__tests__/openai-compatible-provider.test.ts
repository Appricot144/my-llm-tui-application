import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  convertMessages,
  convertTools,
  OpenAICompatibleProvider,
} from "../providers/openai-compatible.ts";
import type { AppConfig } from "../config/config.ts";
import type { MessageParam, ToolSchema } from "../providers/types.ts";

// ========================================================
// convertMessages のテスト
// ========================================================

describe("convertMessages", () => {
  it("system プロンプトを system ロールメッセージに変換すること", () => {
    const result = convertMessages("あなたはアシスタントです", []);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "system", content: "あなたはアシスタントです" });
  });

  it("system が空の場合はメッセージを追加しないこと", () => {
    const result = convertMessages("", []);
    expect(result).toHaveLength(0);
  });

  it("文字列コンテンツのユーザーメッセージを変換すること", () => {
    const messages: MessageParam[] = [
      { role: "user", content: "こんにちは" },
    ];
    const result = convertMessages("", messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "user", content: "こんにちは" });
  });

  it("文字列コンテンツのアシスタントメッセージを変換すること", () => {
    const messages: MessageParam[] = [
      { role: "assistant", content: "よろしくお願いします" },
    ];
    const result = convertMessages("", messages);
    expect(result).toEqual([{ role: "assistant", content: "よろしくお願いします" }]);
  });

  it("テキストブロックのアシスタントメッセージを変換すること", () => {
    const messages: MessageParam[] = [
      {
        role: "assistant",
        content: [{ type: "text", text: "応答テキスト" }],
      },
    ];
    const result = convertMessages("", messages);
    expect(result).toEqual([{ role: "assistant", content: "応答テキスト" }]);
  });

  it("tool_use ブロックを tool_calls に変換すること", () => {
    const messages: MessageParam[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "call_001",
            name: "read_file",
            input: { path: "/foo/bar.ts" },
          },
        ],
      },
    ];
    const result = convertMessages("", messages);
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("assistant");
    expect(result[0]!.tool_calls).toHaveLength(1);
    expect(result[0]!.tool_calls![0]).toEqual({
      id: "call_001",
      type: "function",
      function: {
        name: "read_file",
        arguments: JSON.stringify({ path: "/foo/bar.ts" }),
      },
    });
  });

  it("テキストと tool_use を含むアシスタントメッセージを変換すること", () => {
    const messages: MessageParam[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "ファイルを読みます" },
          {
            type: "tool_use",
            id: "call_002",
            name: "read_file",
            input: { path: "/src/index.ts" },
          },
        ],
      },
    ];
    const result = convertMessages("", messages);
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe("ファイルを読みます");
    expect(result[0]!.tool_calls).toHaveLength(1);
  });

  it("tool_result ブロックを tool ロールメッセージに変換すること", () => {
    const messages: MessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_001",
            content: "ファイルの内容です",
          },
        ],
      },
    ];
    const result = convertMessages("", messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "tool",
      tool_call_id: "call_001",
      content: "ファイルの内容です",
    });
  });
});

// ========================================================
// convertTools のテスト
// ========================================================

describe("convertTools", () => {
  it("Anthropic ToolSchema を OpenAI tools 形式に変換すること", () => {
    const tools: ToolSchema[] = [
      {
        name: "read_file",
        description: "ファイルを読む",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    ];
    const result = convertTools(tools);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "function",
      function: {
        name: "read_file",
        description: "ファイルを読む",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    });
  });

  it("複数のツールを変換すること", () => {
    const tools: ToolSchema[] = [
      {
        name: "tool_a",
        description: "ツールA",
        input_schema: { type: "object", properties: {} },
      },
      {
        name: "tool_b",
        description: "ツールB",
        input_schema: { type: "object", properties: {} },
      },
    ];
    const result = convertTools(tools);
    expect(result).toHaveLength(2);
    expect(result[0]!.function.name).toBe("tool_a");
    expect(result[1]!.function.name).toBe("tool_b");
  });
});

// ========================================================
// OpenAICompatibleProvider のテスト
// ========================================================

describe("OpenAICompatibleProvider", () => {
  const baseConfig: AppConfig = {
    provider: "openai-compatible",
    baseUrl: "https://api.example.com",
    model: "custom-model",
    apiKey: "test-api-key",
  };

  it("baseUrl が未指定の場合エラーをスローすること", () => {
    expect(() => {
      new OpenAICompatibleProvider({ ...baseConfig, baseUrl: undefined });
    }).toThrow();
  });

  it("supportsTools はデフォルトで false であること", () => {
    const provider = new OpenAICompatibleProvider(baseConfig);
    expect(provider.supportsTools).toBe(false);
  });

  it("toolUse: true の場合 supportsTools が true になること", () => {
    const provider = new OpenAICompatibleProvider({ ...baseConfig, toolUse: true });
    expect(provider.supportsTools).toBe(true);
  });

  describe("streamMessage", () => {
    let mockFetch: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockFetch = vi.spyOn(globalThis, "fetch");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function createSSEStream(events: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(event));
          }
          controller.close();
        },
      });
    }

    it("テキストレスポンスをストリーミングで受信すること", async () => {
      const sseEvents = [
        'data: {"choices":[{"delta":{"content":"こんに"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":"ちは"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
        "data: [DONE]\n\n",
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        body: createSSEStream(sseEvents),
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider(baseConfig);
      const deltas: string[] = [];
      const result = await provider.streamMessage(
        {
          model: "custom-model",
          maxTokens: 1024,
          system: "テスト",
          messages: [{ role: "user", content: "こんにちは" }],
        },
        (fullText) => deltas.push(fullText)
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({ type: "text", text: "こんにちは" });
      expect(result.stopReason).toBe("end_turn");
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(deltas).toEqual(["こんに", "こんにちは"]);
    });

    it("Authorization ヘッダーに apiKey を設定してリクエストすること", async () => {
      const sseEvents = [
        'data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\n',
        "data: [DONE]\n\n",
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        body: createSSEStream(sseEvents),
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider(baseConfig);
      await provider.streamMessage(
        { model: "custom-model", maxTokens: 100, system: "", messages: [] },
        () => {}
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/v1/chat/completions",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        })
      );
    });

    it("カスタムヘッダーをリクエストに含めること", async () => {
      const sseEvents = [
        'data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\n',
        "data: [DONE]\n\n",
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        body: createSSEStream(sseEvents),
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider({
        ...baseConfig,
        headers: { "X-Custom-Header": "custom-value" },
      });
      await provider.streamMessage(
        { model: "custom-model", maxTokens: 100, system: "", messages: [] },
        () => {}
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom-Header": "custom-value",
          }),
        })
      );
    });

    it("HTTP エラーの場合は例外をスローすること", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider(baseConfig);
      await expect(
        provider.streamMessage(
          { model: "custom-model", maxTokens: 100, system: "", messages: [] },
          () => {}
        )
      ).rejects.toThrow("401");
    });

    it("finish_reason が tool_calls の場合 stopReason が tool_use になること", async () => {
      const sseEvents = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read_file","arguments":"{\\"path\\":\\"/src\\"}"}}]},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":5,"completion_tokens":10}}\n\n',
        "data: [DONE]\n\n",
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        body: createSSEStream(sseEvents),
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider({ ...baseConfig, toolUse: true });
      const result = await provider.streamMessage(
        { model: "custom-model", maxTokens: 100, system: "", messages: [] },
        () => {}
      );

      expect(result.stopReason).toBe("tool_use");
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "tool_use",
        id: "call_1",
        name: "read_file",
        input: { path: "/src" },
      });
    });
  });
});
