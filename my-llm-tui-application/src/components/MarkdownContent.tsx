import { CodeRenderable } from "@opentui/core";
import type { RenderNodeContext, Renderable } from "@opentui/core";
import { appSyntaxStyle } from "../utils/syntaxStyleFactory.ts";
import { MARKDOWN_TABLE_OPTIONS } from "../utils/markdownTableOptions.ts";
import { CodeBlockRenderable } from "./CodeBlockRenderable.ts";

export { MARKDOWN_TABLE_OPTIONS };

function renderCodeBlock(
  token: { type: string; lang?: string },
  context: RenderNodeContext,
): Renderable | undefined | null {
  if (token.type !== "code") return undefined;

  const codeRenderable = context.defaultRender();
  if (!codeRenderable) return null;

  return new CodeBlockRenderable(
    codeRenderable.ctx,
    codeRenderable as CodeRenderable,
    token.lang || undefined,
  );
}

interface Props {
  content: string;
  streaming?: boolean;
}

export function MarkdownContent({ content, streaming = false }: Props) {
  return (
    <markdown
      content={content}
      syntaxStyle={appSyntaxStyle}
      streaming={streaming}
      conceal={true}
      concealCode={false}
      tableOptions={MARKDOWN_TABLE_OPTIONS}
      renderNode={renderCodeBlock}
    />
  );
}
