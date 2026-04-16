import { tokenizeCode } from "../utils/syntaxHighlight.ts";

interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const lines = tokenizeCode(code, language);
  const langLabel = language && language !== "text" ? language : "code";

  return (
    <box flexDirection="column" marginTop={1} marginBottom={1}>
      <box paddingLeft={2}>
        <text fg="#569cd6">{langLabel}</text>
      </box>
      <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={0} paddingBottom={0}>
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
