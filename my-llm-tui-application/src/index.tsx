import { createCliRenderer, TextAttributes } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useChat } from "./hooks/useChat.ts";
import { MessageList } from "./components/MessageList.tsx";
import { ChatInput } from "./components/ChatInput.tsx";

function App() {
  const { messages, loading, setLoading, addUserMessage, addAssistantMessage, updateLastAssistantMessage } = useChat();

  const handleSubmit = async (text: string) => {
    addUserMessage(text);
    setLoading(true);

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic();

      const apiMessages = messages.map(({ role, content }: { role: "user" | "assistant"; content: string }) => ({ role, content }));
      apiMessages.push({ role: "user" as const, content: text });

      addAssistantMessage("");

      const stream = client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: apiMessages,
      });

      let fullText = "";
      stream.on("text", (text) => {
        fullText += text;
        updateLastAssistantMessage(fullText);
      });

      await stream.finalMessage();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
      addAssistantMessage(`エラー: ${errorMessage}`);
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
        <text fg="#666666"> | Ctrl+C で終了</text>
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
