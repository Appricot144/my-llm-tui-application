# llm-chat-tui

ターミナルで動作する LLM チャットアプリケーション。Anthropic Claude API を利用し、会話からコードレビューまで4つのモードを切り替えて使えます。

## 特徴

- **4つのモード** — Chat / Coding / Debug / Review を Shift+Tab で切り替え
- **エージェント機能** — Coding・Debug・Review モードでは、LLM がプロジェクト内のファイルを自律的に探索・読み取り・検索
- **ストリーミング表示** — レスポンスをリアルタイムに表示
- **トークン使用量表示** — セッション中の累計トークン消費を常時表示
- **セキュリティ境界** — ファイルアクセスはプロジェクトルート内に制限

## 必要な環境

- [Bun](https://bun.sh/) >= 1.0.0
- Anthropic API キー（環境変数 `ANTHROPIC_API_KEY`）

## インストール

```bash
npm install -g llm-chat-tui
```

## 使い方

```bash
# API キーを設定
export ANTHROPIC_API_KEY="your-api-key"

# 起動
llm-chat
```

エージェントモード（Coding / Debug / Review）では、コマンドを実行したディレクトリがプロジェクトルートとして設定されます。

## 開発

```bash
# 依存関係のインストール
bun install

# 開発モード（ファイル変更で自動リロード）
bun dev

# テスト
bun test

# 直接起動
bun start
```

## キーバインド

| キー | 動作 |
|---|---|
| `Enter` | メッセージ送信 |
| `Shift+Tab` | モード切替（Chat → Coding → Debug → Review → Chat） |
| `Ctrl+U` | 入力行クリア |
| `Ctrl+C` | 終了 |

## モード

| モード | ツール | 用途 |
|---|---|---|
| **Chat** | なし | 純粋な会話 |
| **Coding** | あり | コードの実装方針の提案 |
| **Debug** | あり | バグの原因特定と修正案 |
| **Review** | あり | コード品質のレビュー |

## エージェントツール

Coding・Debug・Review モードで LLM が使用できるツール：

- **list_directory** — ディレクトリ構造の表示（ツリー形式）
- **read_file** — ファイル内容の読み取り（行範囲指定可能）
- **search_code** — 正規表現によるコード検索

## 設定ファイルの使い方

### 1. ファイルの置き場所

以下の順で探索されます（先に見つかった方が使われます）：

~/.config/llm-tui/config.json   ← 優先（グローバル設定）
./config.json                   ← 次点（プロジェクトローカル）

設定ファイルがない場合は Anthropic のデフォルト設定（ANTHROPIC_API_KEY 環境変数）が使われます。

### 2. パターン別の設定例

Anthropic（デフォルトと同じ）
```
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "apiKey": "${ANTHROPIC_API_KEY}"
}
```
Anthropic 互換プロキシ（baseUrl だけ変える）
```
{
  "provider": "anthropic",
  "baseUrl": "https://your-proxy.example.com",
  "model": "claude-sonnet-v2",
  "apiKey": "${YOUR_API_KEY}",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```
OpenAI 互換（Bedrock wrapper 等）
```
{
  "provider": "openai-compatible",
  "baseUrl": "https://your-bedrock-wrapper.example.com",
  "model": "your-custom-model",
  "apiKey": "${YOUR_API_KEY}",
  "headers": {
    "X-Service-Token": "${SERVICE_TOKEN}"
  },
  "toolUse": false
}
```
### 3. 設定項目一覧

|キー|必須|説明|
|---|---|---|
| provider | ✓ |"anthropic" または "openai-compatible" |
| model    | ✓ | モデル名（例: "claude-sonnet-4-20250514"） |
| baseUrl  | openai-compatible は必須 | カスタムエンドポイント URL |
| apiKey   | — | API キー。省略時は SDK デフォルト（環境変数）を使用 |
| headers  | — | リクエストに追加するカスタムヘッダー（任意の数）|
| toolUse  | — | ツール使用の有効/無効。省略時: anthropic=true、openai-compatible=false |

### 4. 環境変数参照

apiKey や headers の値に ${VAR_NAME} と書くと、実行時に環境変数の値に展開されます。

export YOUR_API_KEY="sk-xxxx"
export SERVICE_TOKEN="token-yyyy"

設定ファイルにシークレットを直書きせずに済みます。

## ライセンス

MIT
