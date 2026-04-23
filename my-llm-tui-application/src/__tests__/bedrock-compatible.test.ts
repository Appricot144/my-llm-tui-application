import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppConfig } from "../config/config.ts";
import {
  BedrockCompatibleProvider,
  parseAnthropicSSEStream,
  parseJsonResponse,
} from "../providers/bedrock-compatible.ts";

// ========================================================
// fetch モック ヘルパー
// ========================================================

function makeSSEResponse(lines: string[]): Response {
  const text = lines.join("\n") + "\n";
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const baseConfig: AppConfig = {
  provider: "bedrock-compatible",
  model: "claude-sonnet-4-6",
  baseUrl: "https://proxy.example.com/bedrock/model/claude-sonnet-4-6/invoke",
  headers: {
    Authorization: "Bearer test-token default",
  },
};

// ========================================================
// BedrockCompatibleProvider
// ========================================================

describe("BedrockCompatibleProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("baseUrl がない場合エラーを投げること", () => {
    expect(
      () => new BedrockCompatibleProvider({ ...baseConfig, baseUrl: undefined })
    ).toThrow("baseUrl が必要です");
  });

  it("supportsTools はデフォルトで true であること", () => {
    const provider = new BedrockCompatibleProvider(baseConfig);
    expect(provider.supportsTools).toBe(true);
  });

  it("toolUse: false の場合 supportsTools が false になること", () => {
    const provider = new BedrockCompatibleProvider({ ...baseConfig, toolUse: false });
    expect(provider.supportsTools).toBe(false);
  });

  it("claude-sonnet-4-6 の場合 supportsPromptCaching は true であること", () => {
    const provider = new BedrockCompatibleProvider(baseConfig);
    expect(provider.supportsPromptCaching).toBe(true);
  });

  it("キャッシング非対応モデルの場合 supportsPromptCaching は false であること", () => {
    const provider = new BedrockCompatibleProvider({ ...baseConfig, model: "claude-2.1" });
    expect(provider.supportsPromptCaching).toBe(false);
  });

  describe("streamMessage — リクエスト内容", () => {
    it("Bedrock 形式のボディを baseUrl にそのまま POST すること", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        makeJsonResponse({
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 3 },
        })
      );

      const provider = new BedrockCompatibleProvider(baseConfig);
      await provider.streamMessage(
        {
          model: "claude-sonnet-4-6",
          maxTokens: 1024,
          system: "システム",
          messages: [{ role: "user", content: "こんにちは" }],
        },
        () => {}
      );

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(baseConfig.baseUrl);
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body["anthropic_version"]).toBe("bedrock-2023-05-31");
      expect(body["max_tokens"]).toBe(1024);
      expect(body["system"]).toEqual([
        { type: "text", text: "システム", cache_control: { type: "ephemeral" } },
      ]);
      expect(body["messages"]).toEqual([{ role: "user", content: "こんにちは" }]);
    });

    it("キャッシング非対応モデルの場合 system を文字列で送ること", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        makeJsonResponse({
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 3 },
        })
      );

      const provider = new BedrockCompatibleProvider({ ...baseConfig, model: "claude-2.1" });
      await provider.streamMessage(
        {
          model: "claude-2.1",
          maxTokens: 1024,
          system: "システム",
          messages: [{ role: "user", content: "こんにちは" }],
        },
        () => {}
      );

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body["system"]).toBe("システム");
    });

    it("config.headers が Authorization を含めすべてのヘッダーに反映されること", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        makeJsonResponse({
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 3 },
        })
      );

      const provider = new BedrockCompatibleProvider(baseConfig);
      await provider.streamMessage(
        { model: "m", maxTokens: 100, system: "", messages: [] },
        () => {}
      );

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Authorization"]).toBe("Bearer test-token default");
    });

    it("tools がある場合リクエストボディに含まれること", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        makeJsonResponse({
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        })
      );

      const tool = {
        name: "read_file",
        description: "ファイルを読む",
        input_schema: {
          type: "object" as const,
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      };

      const provider = new BedrockCompatibleProvider(baseConfig);
      await provider.streamMessage(
        { model: "m", maxTokens: 100, system: "", messages: [], tools: [tool] },
        () => {}
      );

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body["tools"]).toEqual([tool]);
    });

    it("HTTP エラーの場合例外を投げること", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Unauthorized", { status: 401 })
      );

      const provider = new BedrockCompatibleProvider(baseConfig);
      await expect(
        provider.streamMessage({ model: "m", maxTokens: 100, system: "", messages: [] }, () => {})
      ).rejects.toThrow("HTTP 401");
    });
  });

  describe("streamMessage — JSON レスポンス (non-streaming)", () => {
    it("テキストレスポンスを正規化して返すこと", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        makeJsonResponse({
          content: [{ type: "text", text: "Hello World" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        })
      );

      const provider = new BedrockCompatibleProvider(baseConfig);
      const deltas: string[] = [];
      const result = await provider.streamMessage(
        { model: "m", maxTokens: 100, system: "", messages: [] },
        (text) => deltas.push(text)
      );

      expect(result.content).toEqual([{ type: "text", text: "Hello World" }]);
      expect(result.stopReason).toBe("end_turn");
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
      expect(deltas).toEqual(["Hello World"]);
    });

    it("tool_use レスポンスを正規化して返すこと", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        makeJsonResponse({
          content: [
            {
              type: "tool_use",
              id: "call_1",
              name: "read_file",
              input: { path: "/src/index.ts" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 20, output_tokens: 15 },
        })
      );

      const provider = new BedrockCompatibleProvider(baseConfig);
      const result = await provider.streamMessage(
        { model: "m", maxTokens: 100, system: "", messages: [] },
        () => {}
      );

      expect(result.stopReason).toBe("tool_use");
      expect(result.content[0]).toEqual({
        type: "tool_use",
        id: "call_1",
        name: "read_file",
        input: { path: "/src/index.ts" },
      });
    });

    it("stop_reason が max_tokens の場合 stopReason が max_tokens になること", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        makeJsonResponse({
          content: [{ type: "text", text: "途中..." }],
          stop_reason: "max_tokens",
          usage: { input_tokens: 100, output_tokens: 4096 },
        })
      );

      const provider = new BedrockCompatibleProvider(baseConfig);
      const result = await provider.streamMessage(
        { model: "m", maxTokens: 4096, system: "", messages: [] },
        () => {}
      );

      expect(result.stopReason).toBe("max_tokens");
    });
  });

  describe("streamMessage — SSE レスポンス (streaming)", () => {
    it("テキストデルタを蓄積して返すこと", async () => {
      const sseLines = [
        `data: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 8 } } })}`,
        `data: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}`,
        `data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } })}`,
        `data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: " World" } })}`,
        `data: ${JSON.stringify({ type: "content_block_stop", index: 0 })}`,
        `data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 4 } })}`,
        "data: [DONE]",
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValue(makeSSEResponse(sseLines));

      const provider = new BedrockCompatibleProvider(baseConfig);
      const deltas: string[] = [];
      const result = await provider.streamMessage(
        { model: "m", maxTokens: 100, system: "", messages: [] },
        (text) => deltas.push(text)
      );

      expect(result.content).toEqual([{ type: "text", text: "Hello World" }]);
      expect(result.stopReason).toBe("end_turn");
      expect(result.usage).toEqual({ inputTokens: 8, outputTokens: 4 });
      expect(deltas).toEqual(["Hello", "Hello World"]);
    });

    it("tool_use ブロックを SSE から正しく組み立てること", async () => {
      const sseLines = [
        `data: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 15 } } })}`,
        `data: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "call_abc", name: "read_file" } })}`,
        `data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"path":' } })}`,
        `data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '"/src"}' } })}`,
        `data: ${JSON.stringify({ type: "content_block_stop", index: 0 })}`,
        `data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 10 } })}`,
        "data: [DONE]",
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValue(makeSSEResponse(sseLines));

      const provider = new BedrockCompatibleProvider(baseConfig);
      const result = await provider.streamMessage(
        { model: "m", maxTokens: 100, system: "", messages: [] },
        () => {}
      );

      expect(result.stopReason).toBe("tool_use");
      expect(result.content).toEqual([
        {
          type: "tool_use",
          id: "call_abc",
          name: "read_file",
          input: { path: "/src" },
        },
      ]);
    });
  });
});

// ========================================================
// parseAnthropicSSEStream 単体テスト
// ========================================================

describe("parseAnthropicSSEStream", () => {
  it("不正な JSON 行を無視して処理を継続すること", async () => {
    const lines = [
      "data: INVALID_JSON",
      `data: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 5 } } })}`,
      `data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "OK" } })}`,
      `data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } })}`,
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(lines.join("\n") + "\n"));
        controller.close();
      },
    });

    const result = await parseAnthropicSSEStream(stream, () => {});
    expect(result.content).toEqual([{ type: "text", text: "OK" }]);
  });
});

// ========================================================
// parseJsonResponse 単体テスト
// ========================================================

describe("parseJsonResponse", () => {
  it("テキストと tool_use が混在するレスポンスを正規化すること", async () => {
    const response = makeJsonResponse({
      content: [
        { type: "text", text: "考え中..." },
        { type: "tool_use", id: "t1", name: "search", input: { query: "foo" } },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 30, output_tokens: 20 },
    });

    const deltas: string[] = [];
    const result = await parseJsonResponse(response, (t) => deltas.push(t));

    expect(result.content).toEqual([
      { type: "text", text: "考え中..." },
      { type: "tool_use", id: "t1", name: "search", input: { query: "foo" } },
    ]);
    expect(result.stopReason).toBe("tool_use");
    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 20 });
    expect(deltas).toEqual(["考え中..."]);
  });
});
