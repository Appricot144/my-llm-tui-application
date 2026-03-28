import { createCliRenderer, TextAttributes } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useChat } from "./hooks/useChat.ts";
import { MessageList } from "./components/MessageList.tsx";
import { ChatInput } from "./components/ChatInput.tsx";
import { run } from "./agent/agent.ts";
import type { Message } from "./types.ts";

const PROJECT_ROOT = process.cwd();

function App() {
  const { messages, loading, setLoading, addUserMessage, addAssistantMessage, updateLastAssistantMessage } = useChat();

  const handleSubmit = async (text: string) => {
    addUserMessage(text);
    setLoading(true);
    addAssistantMessage("");

    try {
      // 会話履歴をAPI形式に変換（今回のメッセージは含めない）
      const conversationHistory = messages.map(
        ({ role, content }: Message) => ({ role, content })
      );

      await run({
        userMessage: text,
        conversationHistory,
        projectRoot: PROJECT_ROOT,
        mode: "chat",
        onTextDelta: (fullText) => {
          updateLastAssistantMessage(fullText);
        },
        onToolUse: (toolName, toolInput) => {
          const inputPreview = JSON.stringify(toolInput).slice(0, 80);
          updateLastAssistantMessage(`[ツール実行中] ${toolName}(${inputPreview})\n`);
        },
      });
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
      >
        <text fg="#4fc3f7" attributes={TextAttributes.BOLD}>LLM Chat</text>
        <text fg="#666666"> | Chat Mode | Ctrl+C で終了</text>
      </box>
      <MessageList messages={messages} loading={loading} />
      <ChatInput
        onSubmit={handleSubmit}
        disabled={loading}
      />
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
