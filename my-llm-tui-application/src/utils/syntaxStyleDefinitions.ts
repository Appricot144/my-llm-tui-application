interface StyleInput {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
}

export const SYNTAX_STYLE_DEFINITIONS: Record<string, StyleInput> = {
  "markup.heading":    { fg: "#4fc3f7", bold: true },
  "markup.heading.1":  { fg: "#4fc3f7", bold: true },
  "markup.heading.2":  { fg: "#81c784", bold: true },
  "markup.heading.3":  { fg: "#ffb74d", bold: true },
  "markup.bold":       { bold: true },
  "markup.italic":     { italic: true },
  "markup.inline.raw": { fg: "#ce9178" },
  "markup.rule":       { fg: "#555555", dim: true },
  keyword:             { fg: "#c586c0" },
  string:              { fg: "#ce9178" },
  number:              { fg: "#b5cea8" },
  comment:             { fg: "#6a9955" },
  function:            { fg: "#dcdcaa" },
  type:                { fg: "#4ec9b0" },
};
