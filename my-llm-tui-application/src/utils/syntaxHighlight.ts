export type Token = {
  text: string;
  color: string;
};

const COLORS = {
  keyword: "#c586c0",
  string: "#ce9178",
  number: "#b5cea8",
  comment: "#6a9955",
  function: "#dcdcaa",
  type: "#4ec9b0",
  operator: "#d4d4d4",
  plain: "#d4d4d4",
};

const TS_JS_KEYWORDS = new Set([
  "const", "let", "var", "function", "class", "interface", "type", "enum",
  "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
  "return", "throw", "try", "catch", "finally", "new", "delete", "typeof",
  "instanceof", "in", "of", "import", "export", "default", "from", "as",
  "async", "await", "extends", "implements", "public", "private", "protected",
  "static", "readonly", "abstract", "override", "void", "null", "undefined",
  "true", "false", "this", "super", "yield",
]);

const PYTHON_KEYWORDS = new Set([
  "def", "class", "if", "elif", "else", "for", "while", "return", "import",
  "from", "as", "try", "except", "finally", "raise", "with", "pass", "break",
  "continue", "lambda", "yield", "global", "nonlocal", "and", "or", "not",
  "in", "is", "True", "False", "None", "async", "await",
]);

const RUST_KEYWORDS = new Set([
  "fn", "let", "mut", "const", "struct", "enum", "impl", "trait", "if",
  "else", "for", "while", "loop", "return", "match", "use", "mod", "pub",
  "crate", "super", "self", "where", "type", "move", "async", "await",
  "dyn", "ref", "in", "break", "continue", "true", "false",
]);

const GO_KEYWORDS = new Set([
  "func", "var", "const", "type", "struct", "interface", "map", "chan",
  "if", "else", "for", "range", "return", "switch", "case", "default",
  "break", "continue", "goto", "fallthrough", "import", "package", "go",
  "defer", "select", "true", "false", "nil",
]);

const BASH_KEYWORDS = new Set([
  "if", "then", "else", "elif", "fi", "for", "do", "done", "while",
  "case", "esac", "function", "return", "export", "local", "source",
  "echo", "exit", "set", "unset", "readonly",
]);

function getKeywordSet(language: string): Set<string> {
  const lang = language.toLowerCase();
  if (lang === "ts" || lang === "tsx" || lang === "typescript" ||
      lang === "js" || lang === "jsx" || lang === "javascript") {
    return TS_JS_KEYWORDS;
  }
  if (lang === "python" || lang === "py") return PYTHON_KEYWORDS;
  if (lang === "rust" || lang === "rs") return RUST_KEYWORDS;
  if (lang === "go") return GO_KEYWORDS;
  if (lang === "bash" || lang === "sh" || lang === "shell") return BASH_KEYWORDS;
  return TS_JS_KEYWORDS;
}

type TokenizeRule = {
  pattern: RegExp;
  getColor: (match: string, keywords: Set<string>) => string;
};

const RULES: TokenizeRule[] = [
  // Line comments //
  {
    pattern: /\/\/.*/,
    getColor: () => COLORS.comment,
  },
  // Block comments /* */
  {
    pattern: /\/\*[\s\S]*?\*\//,
    getColor: () => COLORS.comment,
  },
  // Python/bash comments #
  {
    pattern: /#.*/,
    getColor: () => COLORS.comment,
  },
  // Template literals `...`
  {
    pattern: /`[^`\\]*(?:\\[\s\S][^`\\]*)*`/,
    getColor: () => COLORS.string,
  },
  // Double-quoted strings
  {
    pattern: /"[^"\\]*(?:\\[\s\S][^"\\]*)*"/,
    getColor: () => COLORS.string,
  },
  // Single-quoted strings
  {
    pattern: /'[^'\\]*(?:\\[\s\S][^'\\]*)*'/,
    getColor: () => COLORS.string,
  },
  // Numbers
  {
    pattern: /\b\d+\.?\d*\b/,
    getColor: () => COLORS.number,
  },
  // Identifiers (keywords and function calls)
  {
    pattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/,
    getColor: (match, keywords) => {
      if (keywords.has(match)) return COLORS.keyword;
      return COLORS.plain;
    },
  },
];

function tokenizeLine(line: string, keywords: Set<string>): Token[] {
  if (line.length === 0) return [{ text: "", color: COLORS.plain }];

  const tokens: Token[] = [];
  let pos = 0;

  while (pos < line.length) {
    let matched = false;

    for (const rule of RULES) {
      const rulePattern = new RegExp(rule.pattern.source, "y");
      rulePattern.lastIndex = pos;
      const m = rulePattern.exec(line);
      if (m) {
        tokens.push({ text: m[0], color: rule.getColor(m[0], keywords) });
        pos += m[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Consume one character as plain text
      const lastToken = tokens[tokens.length - 1];
      if (lastToken && lastToken.color === COLORS.plain) {
        lastToken.text += line[pos];
      } else {
        tokens.push({ text: line[pos], color: COLORS.plain });
      }
      pos++;
    }
  }

  return tokens;
}

export function tokenizeCode(code: string, language: string): Token[][] {
  const keywords = getKeywordSet(language);
  const lines = code.split("\n");
  // Remove trailing empty line only when code explicitly ends with newline
  if (code.endsWith("\n") && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.map((line) => tokenizeLine(line, keywords));
}
