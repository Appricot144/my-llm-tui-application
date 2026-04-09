import type { Message } from "../types.ts";
import { LoadingSpinner } from "./LoadingSpinner.tsx";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
}

export function MessageList({ messages, loading }: MessageListProps) {
  if (messages.length === 0 && !loading) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text>メッセージを入力してください</text>
      </box>
    );
  }

  return (
    <scrollbox flexGrow={1} stickyScroll={true} stickyStart="bottom" paddingLeft={1} paddingRight={1}>
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const label = isUser ? "You" : "AI";
        const labelColor = isUser ? "#4fc3f7" : "#81c784";
        return (
          <box key={msg.id} flexDirection="column" marginTop={1}>
            <text fg={labelColor} attributes={1}>{label}</text>
            <box marginLeft={2}>
              <text>{msg.content}</text>
            </box>
          </box>
        );
      })}
      {loading && (
        <box marginTop={1}>
          <LoadingSpinner />
        </box>
      )}
    </scrollbox>
  );
}