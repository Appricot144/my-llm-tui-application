import { BoxRenderable, CodeRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext, SyntaxStyle } from "@opentui/core";

export const CODE_BLOCK_BG = "#2d2d2d";

const LANG_LABEL_FG = "#808080";

/**
 * コードブロック用ラッパー。
 *
 * BoxRenderable として描画しつつ、MarkdownRenderable が applyCodeBlockRenderable で
 * 呼び出す各セッター（content/filetype/syntaxStyle/fg/conceal/drawUnstyledText/streaming）を
 * 内部の CodeRenderable に委譲する。
 * bg セッターは無視し、コンストラクタで設定した CODE_BLOCK_BG を維持する。
 */
export class CodeBlockRenderable extends BoxRenderable {
  private _code: CodeRenderable;

  constructor(ctx: RenderContext, code: CodeRenderable, lang?: string) {
    super(ctx, {
      backgroundColor: CODE_BLOCK_BG,
      width: "100%",
      flexDirection: "column",
    });

    this._code = code;
    this._code.bg = CODE_BLOCK_BG;

    if (lang) {
      this.add(
        new TextRenderable(ctx, {
          content: lang,
          fg: LANG_LABEL_FG,
          bg: CODE_BLOCK_BG,
          paddingLeft: 1,
        }),
      );
    }

    this.add(code);
  }

  set content(v: string) {
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
