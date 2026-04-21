import {
  BoxRenderable,
  CodeRenderable,
  LineNumberRenderable,
  TextRenderable,
} from "@opentui/core";
import type { RenderContext, SyntaxStyle } from "@opentui/core";

export const CODE_BLOCK_BG = "#2d2d2d";

const LANG_LABEL_FG = "#808080";
const LINE_NUMBER_FG = "#555555";
const COPY_BUTTON_FG = "#555555";
const COPY_BUTTON_HOVER_FG = "#aaaaaa";
const COPY_DONE_FG = "#81c784";

const COPY_LABEL = "[ copy ]";
const COPIED_LABEL = "[ copied! ]";
const COPY_RESET_MS = 2000;

export class CodeBlockRenderable extends BoxRenderable {
  private _code: CodeRenderable;
  private _rawContent: string = "";
  private _copyButton: TextRenderable;
  private _copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private _isCopied: boolean = false;

  constructor(ctx: RenderContext, code: CodeRenderable, lang?: string) {
    super(ctx, {
      backgroundColor: CODE_BLOCK_BG,
      width: "100%",
      flexDirection: "column",
    });

    this._code = code;
    this._code.bg = CODE_BLOCK_BG;

    const lineNumbers = new LineNumberRenderable(ctx, {
      target: code,
      fg: LINE_NUMBER_FG,
      bg: CODE_BLOCK_BG,
      showLineNumbers: true,
      paddingRight: 1,
    });

    const header = new BoxRenderable(ctx, {
      backgroundColor: CODE_BLOCK_BG,
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
    });

    header.add(
      new TextRenderable(ctx, {
        content: lang ?? "",
        fg: LANG_LABEL_FG,
        bg: CODE_BLOCK_BG,
        paddingLeft: 1,
      }),
    );

    this._copyButton = new TextRenderable(ctx, {
      content: COPY_LABEL,
      fg: COPY_BUTTON_FG,
      bg: CODE_BLOCK_BG,
      paddingRight: 1,
      onMouseOver: () => {
        if (!this._isCopied) {
          this._copyButton.fg = COPY_BUTTON_HOVER_FG;
        }
      },
      onMouseOut: () => {
        if (!this._isCopied) {
          this._copyButton.fg = COPY_BUTTON_FG;
        }
      },
      onMouseDown: () => this._handleCopy(),
    });
    header.add(this._copyButton);

    this.add(header);
    this.add(lineNumbers);
  }

  private _handleCopy(): void {
    const renderer = this._ctx as unknown as {
      copyToClipboardOSC52?: (text: string) => boolean;
    };
    renderer.copyToClipboardOSC52?.(this._rawContent);

    if (this._copyResetTimer !== null) {
      clearTimeout(this._copyResetTimer);
    }

    this._isCopied = true;
    this._copyButton.content = COPIED_LABEL;
    this._copyButton.fg = COPY_DONE_FG;

    this._copyResetTimer = setTimeout(() => {
      this._isCopied = false;
      this._copyButton.content = COPY_LABEL;
      this._copyButton.fg = COPY_BUTTON_FG;
      this._copyResetTimer = null;
    }, COPY_RESET_MS);
  }

  set content(v: string) {
    this._rawContent = v;
    this._code.content = v;
  }

  set filetype(v: string | undefined) {
    this._code.filetype = v;
  }

  get syntaxStyle(): SyntaxStyle {
    return this._code.syntaxStyle;
  }

  set syntaxStyle(v: SyntaxStyle) {
    this._code.syntaxStyle = v;
  }

  set fg(v: string | undefined) {
    this._code.fg = v;
  }

  // applyCodeBlockRenderable の bg 設定を無視し CODE_BLOCK_BG を維持する
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  set bg(_v: unknown) {}

  set conceal(v: boolean) {
    this._code.conceal = v;
  }

  set drawUnstyledText(v: boolean) {
    this._code.drawUnstyledText = v;
  }

  set streaming(v: boolean) {
    this._code.streaming = v;
  }
}
