import type { Message } from "../types.ts";
import { LoadingSpinner } from "./LoadingSpinner.tsx";
import { MarkdownContent } from "./MarkdownContent.tsx";
import { splitUserMessageLines, isStreamingMessage } from "../utils/messageUtils.ts";

const EXT_TO_FILETYPE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rs: "rust",
  go: "go",
  rb: "ruby",
  java: "java",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  sh: "bash",
  toml: "toml",
};

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
        if (msg.role === "diff") {
          return <DiffMessage key={msg.id} message={msg} />;
        }
        if (msg.role === "user") {
          return <UserMessage key={msg.id} content={msg.content} />;
        }
        return (
          <AssistantMessage
            key={msg.id}
            content={msg.content}
            streaming={isStreamingMessage(loading, idx, messages.length)}
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

function DiffMessage({ message }: { message: Message }) {
  const meta = message.diffMeta!;
  const filetype = EXT_TO_FILETYPE[meta.fileExtension];
  return (
    <box flexDirection="column" marginTop={1}>
      <box flexDirection="row">
        <text fg="#ffb74d">  diff </text>
        <text fg="#888888">{meta.filePath}</text>
      </box>
      <box paddingLeft={2}>
        <diff
          diff={meta.unifiedDiff}
          view="unified"
          showLineNumbers={true}
          filetype={filetype}
          addedBg="#1e3a1e"
          removedBg="#3a1e1e"
        />
      </box>
    </box>
  );
}
