import type { Message } from "../types.ts";
import { LoadingSpinner } from "./LoadingSpinner.tsx";
import { MarkdownContent } from "./MarkdownContent.tsx";
import { splitUserMessageLines } from "../utils/messageUtils.ts";

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
      {messages.map((msg, idx) => {
        const isUser = msg.role === "user";
        const isLastMsg = idx === messages.length - 1;
        if (isUser) {
          return <UserMessage key={msg.id} content={msg.content} />;
        }
        return (
          <AssistantMessage
            key={msg.id}
            content={msg.content}
            streaming={loading && isLastMsg}
          />
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

function UserMessage({ content }: { content: string }) {
  const lines = splitUserMessageLines(content);
  return (
    <box flexDirection="column" marginTop={1}>
      <box flexDirection="row">
        <text fg="#4fc3f7">▌ </text>
        <text fg="#4fc3f7" attributes={1}>You</text>
      </box>
      {lines.map((line, i) => (
        <box key={i} flexDirection="row">
          <text fg="#4fc3f7">▌ </text>
          <text fg="#aaddff">{line}</text>
        </box>
      ))}
    </box>
  );
}

function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <box flexDirection="column" marginTop={1}>
      <text fg="#81c784" attributes={1}>  AI</text>
      <box paddingLeft={2}>
        <MarkdownContent content={content} streaming={streaming} />
      </box>
    </box>
  );
}
