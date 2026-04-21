import { SyntaxStyle, parseColor, type StyleDefinition } from "@opentui/core";
import { SYNTAX_STYLE_DEFINITIONS } from "./syntaxStyleDefinitions.ts";

export { SYNTAX_STYLE_DEFINITIONS };

function toStyleDefinitions(
  defs: typeof SYNTAX_STYLE_DEFINITIONS,
): Record<string, StyleDefinition> {
  return Object.fromEntries(
    Object.entries(defs).map(([key, style]) => [
      key,
      {
        ...style,
        fg: style.fg !== undefined ? parseColor(style.fg) : undefined,
        bg: style.bg !== undefined ? parseColor(style.bg) : undefined,
      },
    ]),
  );
}

export const appSyntaxStyle = SyntaxStyle.fromStyles(toStyleDefinitions(SYNTAX_STYLE_DEFINITIONS));
