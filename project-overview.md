# LLM TUI Application - プロジェクト概要

## 概要

AIサービス（Anthropic API）と通信するターミナルUIチャットアプリケーション。
将来的にはコードdiffから試験観点整理表（CSV）を出力するワークフロー機能を搭載予定。

## 技術スタック

| 分類 | 技術 |
|------|------|
| UIフレームワーク | OpenTUI (`@opentui/core`, `@opentui/react`) |
| ライブラリ | React 19 |
| 言語 | TypeScript 5 |
| ランタイム | Bun |
| AIサービス | Anthropic API (`@anthropic-ai/sdk`) |
| テスト | Vitest |

## ディレクトリ構成

```
my-llm-tui-application/
├── memo.md                          # 構想メモ
├── prompt-0001.txt                  # diff→試験観点整理用プロンプト（将来利用）
└── my-llm-tui-application/          # アプリケーション本体
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    └── src/
        ├── index.tsx                # エントリーポイント・Appコンポーネント
        ├── types.ts                 # 型定義（Message, Role）
        ├── hooks/
        │   └── useChat.ts           # チャット状態管理（ChatStore + useChatフック）
        ├── components/
        │   ├── MessageList.tsx      # メッセージ一覧表示（スクロール対応）
        │   └── ChatInput.tsx        # メッセージ入力フィールド
        └── __tests__/
            └── useChat.test.ts      # ChatStoreのユニットテスト（10件）
```

## 実装済み機能

- **チャットUI**: メッセージの送受信表示（ユーザー: 青 / AI: 緑）
- **ストリーミング応答**: Anthropic APIからの応答を逐次表示
- **自動スクロール**: 最新メッセージへの自動スクロール（stickyScroll）
- **ローディング表示**: AI応答待ち中の状態表示
- **エラーハンドリング**: API通信エラー時のメッセージ表示

## コマンド

```bash
# 開発サーバー起動（ANTHROPIC_API_KEY 環境変数が必要）
bun dev

# テスト実行
npm run test

# テスト（ウォッチモード）
npm run test:watch
```

## 今後の実装予定

- コードdiff → プロンプト適用 → CSV出力のワークフロー機能
- diff出力プログラムの実行機能
- プロンプトテンプレートの適用機能
