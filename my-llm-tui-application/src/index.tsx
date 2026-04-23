import { useState, useCallback, useEffect, useRef } from "react";
import { createCliRenderer, TextAttributes } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
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
import { executeCommand } from "./commands/registry.ts";
import { registerInitCommand } from "./commands/init.ts";
import { getProjectContext } from "./agent/projectContext.ts";

const PROJECT_ROOT = process.cwd();
const appConfig = loadConfig();
const provider: LLMProvider = createProvider(appConfig);

export interface PendingConfirm {
  toolName: string;
  input: Record<string, unknown>;
  resolve: (confirmed: boolean) => void;
}

function App({ onExit }: { onExit: () => void }) {
  const { messages, loading, setLoading, addUserMessage, addAssistantMessage, updateLastAssistantMessage } = useChat();
  const [mode, setMode] = useState<Mode>("chat");
  const [totalTokenUsage, setTotalTokenUsage] = useState<TokenUsage>(createTokenUsage());
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [showExitHint, setShowExitHint] = useState(false);
  const planPrefixRef = useRef("");
  const ctrlCTimeRef = useRef<number | null>(null);

  useKeyboard((key) => {
    if (!key.ctrl || key.name !== "c") return;
    const now = Date.now();
    const prev = ctrlCTimeRef.current;
    if (prev !== null && now - prev <= 1500) {
      onExit();
    }
    ctrlCTimeRef.current = now;
    setShowExitHint(true);
    setTimeout(() => {
      ctrlCTimeRef.current = null;
      setShowExitHint(false);
    }, 1500);
  });

  useEffect(() => {
    registerInitCommand({
      provider,
      model: appConfig.model,
      projectRoot: PROJECT_ROOT,
      securityConfig: appConfig.security,
      setLoading,
      addAssistantMessage,
      updateLastAssistantMessage,
      updateTokenUsage: (inputTokens, outputTokens) => {
        setTotalTokenUsage((prev) =>
          addTokenUsage(prev, { input_tokens: inputTokens, output_tokens: outputTokens })
        );
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModeChange = useCallback(() => {
    setMode((prev) => nextMode(prev));
  }, []);

  const handleCommand = useCallback((name: string, args: string) => {
    const found = executeCommand(name, args);
    if (!found) {
      addAssistantMessage(`未知のコマンド: /${name}`);
    }
  }, [addAssistantMessage]);

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
    planPrefixRef.current = "";

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
        projectContext: getProjectContext() ?? undefined,
        onPlanGenerated: (plan) => {
          const lines = plan.tasks.map((t, i) => `${i + 1}. **${t.title}**: ${t.detail}`);
          planPrefixRef.current = `[計画]\n${lines.join("\n")}\n\n`;
          updateLastAssistantMessage(planPrefixRef.current);
        },
        onTextDelta: (fullText) => {
          updateLastAssistantMessage(planPrefixRef.current + fullText);
        },
        onToolUse: (toolName, toolInput) => {
          const inputPreview = JSON.stringify(toolInput).slice(0, 80);
          updateLastAssistantMessage(planPrefixRef.current + `[ツール実行中] ${toolName}(${inputPreview})\n`);
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
        flexDirection="row"
        justifyContent="space-between"
        flexShrink={0}
        overflow="hidden"
      >
        <box flexDirection="column">
          <text fg="#4fc3f7" attributes={TextAttributes.BOLD}>LLM Chat</text>
          <text fg={showExitHint ? "#f4a261" : "#666666"}>
            {MODE_LABELS[mode]} | Shift+Tab でモード切替 | {showExitHint ? "もう一度 Ctrl+C で終了" : "Ctrl+C×2 で終了"}
          </text>
        </box>
        <box flexDirection="row" alignItems="flex-end">
          <text fg="#81c784">{appConfig.provider}</text>
          <text fg="#aaaaaa"> / </text>
          <text fg="#ffb74d">{appConfig.model}</text>
        </box>
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
        onCommand={handleCommand}
        onModeChange={handleModeChange}
        disabled={loading}
        pendingConfirm={pendingConfirm}
        onConfirm={handleConfirm}
      />
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: false });
createRoot(renderer).render(<App onExit={() => renderer.destroy()} />);
