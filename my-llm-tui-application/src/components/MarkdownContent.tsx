import { appSyntaxStyle } from "../utils/syntaxStyleFactory.ts";
import { MARKDOWN_TABLE_OPTIONS } from "../utils/markdownTableOptions.ts";

export { MARKDOWN_TABLE_OPTIONS };

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
    />
  );
}
