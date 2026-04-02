import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppConfig } from "../config/config.ts";

// ========================================================
// Anthropic SDK のモック
// ========================================================

const mockOn = vi.fn();
const mockFinalMessage = vi.fn();
const mockStream = {
  on: mockOn,
  finalMessage: mockFinalMessage,
};
const mockMessagesStream = vi.fn(() => mockStream);

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { stream: mockMessagesStream };
  },
}));

// モック後にインポート
const { AnthropicProvider } = await import("../providers/anthropic.ts");

// ========================================================
// テスト
// ========================================================

describe("AnthropicProvider", () => {
  const baseConfig: AppConfig = {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    apiKey: "test-api-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supportsTools はデフォルトで true であること", () => {
    const provider = new AnthropicProvider(baseConfig);
    expect(provider.supportsTools).toBe(true);
  });

  it("toolUse: false の場合 supportsTools が false になること", () => {
    const provider = new AnthropicProvider({ ...baseConfig, toolUse: false });
    expect(provider.supportsTools).toBe(false);
  });

  describe("streamMessage", () => {
    it("テキストレスポンスを正規化して返すこと", async () => {
      mockOn.mockImplementation((event: string, cb: (text: string) => void) => {
        if (event === "text") {
          cb("Hello");
          cb(" World");
        }
      });
      mockFinalMessage.mockResolvedValue({
        content: [{ type: "text", text: "Hello World" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const provider = new AnthropicProvider(baseConfig);
      const deltas: string[] = [];
      const result = await provider.streamMessage(
        {
          model: "claude-sonnet-4-20250514",
          maxTokens: 1024,
          system: "テスト",
          messages: [{ role: "user", content: "こんにちは" }],
        },
        (fullText) => deltas.push(fullText)
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({ type: "text", text: "Hello World" });
      expect(result.stopReason).toBe("end_turn");
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(deltas).toEqual(["Hello", "Hello World"]);
    });

    it("stop_reason が tool_use の場合 stopReason が tool_use になること", async () => {
      mockOn.mockImplementation(() => {});
      mockFinalMessage.mockResolvedValue({
        content: [
          {
            type: "tool_use",
            id: "call_1",
            name: "read_file",
            input: { path: "/src" },
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 20, output_tokens: 15 },
      });

      const provider = new AnthropicProvider(baseConfig);
      const result = await provider.streamMessage(
        {
          model: "claude-sonnet-4-20250514",
          maxTokens: 1024,
          system: "",
          messages: [],
        },
        () => {}
      );

      expect(result.stopReason).toBe("tool_use");
      expect(result.content[0]).toMatchObject({
        type: "tool_use",
        name: "read_file",
      });
      expect(result.usage.inputTokens).toBe(20);
      expect(result.usage.outputTokens).toBe(15);
    });

    it("stop_reason が max_tokens の場合 stopReason が max_tokens になること", async () => {
      mockOn.mockImplementation(() => {});
      mockFinalMessage.mockResolvedValue({
        content: [{ type: "text", text: "途中まで..." }],
        stop_reason: "max_tokens",
        usage: { input_tokens: 100, output_tokens: 4096 },
      });

      const provider = new AnthropicProvider(baseConfig);
      const result = await provider.streamMessage(
        {
          model: "claude-sonnet-4-20250514",
          maxTokens: 4096,
          system: "",
          messages: [],
        },
        () => {}
      );

      expect(result.stopReason).toBe("max_tokens");
    });

    it("tools パラメータを指定したとき stream に渡すこと", async () => {
      mockOn.mockImplementation(() => {});
      mockFinalMessage.mockResolvedValue({
        content: [{ type: "text", text: "OK" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 5, output_tokens: 3 },
      });

      const provider = new AnthropicProvider(baseConfig);
      await provider.streamMessage(
        {
          model: "claude-sonnet-4-20250514",
          maxTokens: 1024,
          system: "",
          messages: [],
          tools: [
            {
              name: "read_file",
              description: "ファイルを読む",
              input_schema: {
                type: "object",
                properties: { path: { type: "string" } },
                required: ["path"],
              },
            },
          ],
        },
        () => {}
      );

      expect(mockMessagesStream).toHaveBeenCalledWith(
        expect.objectContaining({ tools: expect.any(Array) })
      );
    });
  });
});
