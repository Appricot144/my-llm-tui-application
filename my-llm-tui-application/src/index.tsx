import { useState, useCallback } from "react";
import { createCliRenderer, TextAttributes } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useChat } from "./hooks/useChat.ts";
import { MessageList } from "./components/MessageList.tsx";
import { ChatInput } from "./components/ChatInput.tsx";
import { run } from "./agent/agent.ts";
import { nextMode, MODE_LABELS } from "./utils/modeHelper.ts";
import { createTokenUsage, addTokenUsage, formatTokenUsage, type TokenUsage } from "./utils/tokenUsage.ts";
import { loadConfig } from "./config/config.ts";
import { createProvider } from "./providers/factory.ts";
import type { LLMProvider } from "./providers/types.ts";
import type { Mode } from "./agent/prompts.ts";
import type { Message } from "./types.ts";

const PROJECT_ROOT = process.cwd();
const appConfig = loadConfig();
const provider: LLMProvider = createProvider(appConfig);

export interface PendingConfirm {
  toolName: string;
  input: Record<string, unknown>;
  resolve: (confirmed: boolean) => void;
}

function App() {
  const { messages, loading, setLoading, addUserMessage, addAssistantMessage, updateLastAssistantMessage } = useChat();
  const [mode, setMode] = useState<Mode>("chat");
  const [totalTokenUsage, setTotalTokenUsage] = useState<TokenUsage>(createTokenUsage());
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const handleModeChange = useCallback(() => {
    setMode((prev) => nextMode(prev));
  }, []);

  const handleConfirm = useCallback((confirmed: boolean) => {
    if (pendingConfirm) {
      pendingConfirm.resolve(confirmed);
      setPendingConfirm(null);
    }
  }, [pendingConfirm]);

  const handleSubmit = async (text: string) => {
    addUserMessage(text);
    setLoading(true);
    addAssistantMessage("");

    try {
      const conversationHistory = messages.map(
        ({ role, content }: Message) => ({ role, content })
      );

      const result = await run({
        provider,
        model: appConfig.model,
        userMessage: text,
        conversationHistory,
        projectRoot: PROJECT_ROOT,
        mode,
        securityConfig: appConfig.security,
        onTextDelta: (fullText) => {
          updateLastAssistantMessage(fullText);
        },
        onToolUse: (toolName, toolInput) => {
          const inputPreview = JSON.stringify(toolInput).slice(0, 80);
          updateLastAssistantMessage(`[ツール実行中] ${toolName}(${inputPreview})\n`);
        },
        onToolConfirm: (toolName, toolInput) =>
          new Promise<boolean>((resolve) => {
            setPendingConfirm({ toolName, input: toolInput, resolve });
          }),
      });

      setTotalTokenUsage((prev) => addTokenUsage(prev, {
        input_tokens: result.tokenUsage.inputTokens,
        output_tokens: result.tokenUsage.outputTokens,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
      updateLastAssistantMessage(`エラー: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <box flexDirection="column" flexGrow={1}>
      <box
        borderStyle="rounded"
        border={["bottom"]}
        borderColor="#333333"
        paddingLeft={1}
        flexShrink={0}
        overflow="hidden"
      >
        <text fg="#4fc3f7" attributes={TextAttributes.BOLD}>LLM Chat</text>
        <text fg="#666666"> | {MODE_LABELS[mode]} | Shift+Tab でモード切替 | Ctrl+C で終了</text>
        <text fg="#aaaaaa"> | </text>
        <text fg="#81c784">{appConfig.provider}</text>
        <text fg="#aaaaaa"> / </text>
        <text fg="#ffb74d">{appConfig.model}</text>
      </box>
      <MessageList messages={messages} loading={loading} />
      <box
        flexShrink={0}
        borderStyle="rounded"
        border={["top"]}
        borderColor="#333333"
        paddingLeft={1}
      >
        <text fg="#888888">Tokens: {formatTokenUsage(totalTokenUsage)}</text>
      </box>
      <ChatInput
        onSubmit={handleSubmit}
        onModeChange={handleModeChange}
        disabled={loading}
        pendingConfirm={pendingConfirm}
        onConfirm={handleConfirm}
      />
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
