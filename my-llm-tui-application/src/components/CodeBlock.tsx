import { useState, useCallback } from "react";
import { useRenderer } from "@opentui/react";
import { tokenizeCode } from "../utils/syntaxHighlight.ts";

interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const renderer = useRenderer();
  const [copied, setCopied] = useState(false);
  const lines = tokenizeCode(code, language);
  const langLabel = language && language !== "text" ? language : "code";

  const handleCopy = useCallback(() => {
    renderer.clipboard.copyToClipboardOSC52(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [renderer, code]);

  return (
    <box flexDirection="column" marginTop={1} marginBottom={1}>
      <box flexDirection="row" paddingLeft={2} paddingRight={2}>
        <text fg="#569cd6">{langLabel}</text>
        <box flexGrow={1} />
        <box
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onMouseUp={handleCopy as any}
        >
          {copied
            ? <text fg="#81c784">✓ Copied!</text>
            : <text fg="#888888">[Copy]</text>
          }
        </box>
      </box>
      <box flexDirection="column" paddingLeft={2} paddingRight={2}>
        {lines.map((tokens, lineIndex) => (
          <box key={lineIndex} flexDirection="row">
            <text fg="#555555">{String(lineIndex + 1).padStart(3)} </text>
            {tokens.map((token, tokenIndex) => (
              <text key={tokenIndex} fg={token.color}>{token.text}</text>
            ))}
          </box>
        ))}
      </box>
    </box>
  );
}
