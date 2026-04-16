import type { Message } from "../types.ts";
import { LoadingSpinner } from "./LoadingSpinner.tsx";
import { CodeBlock } from "./CodeBlock.tsx";
import { parseMarkdown } from "../utils/markdownParser.ts";

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
        if (isUser) {
          return <UserMessage key={msg.id} content={msg.content} />;
        }
        return <AssistantMessage key={msg.id} content={msg.content} />;
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
  const lines = content.split("\n");
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

function AssistantMessage({ content }: { content: string }) {
  const segments = parseMarkdown(content);
  return (
    <box flexDirection="column" marginTop={1}>
      <text fg="#81c784" attributes={1}>  AI</text>
      {segments.map((seg, i) => {
        if (seg.type === "code") {
          return <CodeBlock key={i} code={seg.content} language={seg.language} />;
        }
        const lines = seg.content.split("\n");
        return (
          <box key={i} flexDirection="column" paddingLeft={2}>
            {lines.map((line, j) => (
              <text key={j}>{line}</text>
            ))}
          </box>
        );
      })}
    </box>
  );
}
