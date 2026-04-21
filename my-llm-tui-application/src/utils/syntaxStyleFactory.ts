import { SyntaxStyle } from "@opentui/core";
import { SYNTAX_STYLE_DEFINITIONS } from "./syntaxStyleDefinitions.ts";

export { SYNTAX_STYLE_DEFINITIONS };

export const appSyntaxStyle = SyntaxStyle.fromStyles(SYNTAX_STYLE_DEFINITIONS);
