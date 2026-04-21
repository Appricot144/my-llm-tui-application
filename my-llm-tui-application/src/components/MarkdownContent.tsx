import { appSyntaxStyle } from "../utils/syntaxStyleFactory.ts";

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
    />
  );
}
