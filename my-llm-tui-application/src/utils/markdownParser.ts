export type TextSegment = {
  type: "text";
  content: string;
};

export type CodeSegment = {
  type: "code";
  content: string;
  language: string;
};

export type MessageSegment = TextSegment | CodeSegment;

const CODE_BLOCK_PATTERN = /```(\w*)\n([\s\S]*?)```/g;

export function parseMarkdown(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(CODE_BLOCK_PATTERN)) {
    const matchStart = match.index!;

    if (matchStart > lastIndex) {
      const textContent = content.slice(lastIndex, matchStart);
      if (textContent.length > 0) {
        segments.push({ type: "text", content: textContent });
      }
    }

    segments.push({
      type: "code",
      content: match[2],
      language: match[1] || "text",
    });

    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    if (remaining.length > 0) {
      segments.push({ type: "text", content: remaining });
    }
  }

  if (segments.length === 0) {
    segments.push({ type: "text", content });
  }

  return segments;
}
