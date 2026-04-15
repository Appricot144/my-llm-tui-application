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

### 2. プロバイダー仕様

#### `anthropic`

Anthropic SDK を使用して Anthropic API（または Anthropic API 互換エンドポイント）と通信します。

| 項目 | 内容 |
|---|---|
| HTTP クライアント | Anthropic SDK |
| エンドポイント | `{baseUrl}/v1/messages`（`baseUrl` 省略時は公式 API）|
| リクエスト形式 | Anthropic Messages API 形式 |
| 認証 | SDK が `apiKey` を `x-api-key` ヘッダーとして自動付与。`headers` は無視される |
| ストリーミング | SDK 経由（対応）|
| ツール使用 | デフォルト有効（`toolUse: false` で無効化）|

> **注意**: `config.json` の `headers` は `anthropic` プロバイダーでは使用されません。
> 認証は `apiKey`（または環境変数 `ANTHROPIC_API_KEY`）で行い、SDK がヘッダーを管理します。

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "apiKey": "${ANTHROPIC_API_KEY}"
}
```

---

#### `openai-compatible`

OpenAI Chat Completions API と互換のエンドポイントに `fetch` で直接通信します。

| 項目 | 内容 |
|---|---|
| HTTP クライアント | fetch |
| エンドポイント | `{baseUrl}/v1/chat/completions` |
| リクエスト形式 | OpenAI Chat Completions 形式 |
| 認証 | `Authorization: Bearer {apiKey}` を自動付与。`headers` で上書き可 |
| ストリーミング | SSE（`stream: true`、`stream_options.include_usage: true`）|
| ツール使用 | デフォルト無効（`toolUse: true` で有効化）|

```json
{
  "provider": "openai-compatible",
  "baseUrl": "https://your-openai-compatible-proxy.example.com",
  "model": "your-model-name",
  "apiKey": "${YOUR_API_KEY}",
  "toolUse": false
}
```

---

#### `bedrock-compatible`

Bedrock 形式のリクエストを受け付ける独自プロキシ向けプロバイダーです。
`fetch` で `baseUrl` にそのまま POST します（パスの付加なし）。

| 項目 | 内容 |
|---|---|
| HTTP クライアント | fetch |
| エンドポイント | `baseUrl` をそのまま使用（パスを付加しない）|
| リクエスト形式 | Bedrock 形式（`anthropic_version: "bedrock-2023-05-31"`）|
| 認証 | `headers` で完全制御（`Content-Type: application/json` のみ自動付与）|
| ストリーミング | レスポンスの `Content-Type` で自動判別: `text/event-stream` → Anthropic SSE形式、それ以外 → JSON 一括レスポンス |
| ツール使用 | デフォルト有効（`toolUse: false` で無効化）。Bedrock 形式のツール定義を使用 |

```json
{
  "provider": "bedrock-compatible",
  "model": "claude-sonnet-4-6",
  "baseUrl": "https://your-proxy.example.com/bedrock/model/claude-sonnet-4-6/invoke",
  "headers": {
    "Authorization": "Bearer ${YOUR_API_KEY} default"
  }
}
```

---

### 3. プロバイダー比較

| | `anthropic` | `openai-compatible` | `bedrock-compatible` |
|---|---|---|---|
| HTTP クライアント | Anthropic SDK | fetch | fetch |
| エンドポイント | `{baseUrl}/v1/messages` | `{baseUrl}/v1/chat/completions` | `baseUrl` そのまま |
| リクエスト形式 | Anthropic | OpenAI | Bedrock |
| 認証制御 | SDK が `x-api-key` を自動付与（`headers` は無視） | `apiKey` + `headers` | `headers` で完全制御 |
| ツール使用（デフォルト）| 有効 | 無効 | 有効 |

---

### 4. 設定項目一覧

| キー | 必須 | 説明 |
|---|---|---|
| `provider` | ✓ | `"anthropic"` / `"openai-compatible"` / `"bedrock-compatible"` |
| `model` | ✓ | モデル名（例: `"claude-sonnet-4-20250514"`）|
| `baseUrl` | `openai-compatible` / `bedrock-compatible` は必須 | エンドポイント URL |
| `apiKey` | `anthropic` は必須（省略時は `ANTHROPIC_API_KEY` 環境変数で代替） | API キー |
| `headers` | — | カスタムヘッダー。`openai-compatible` / `bedrock-compatible` のみ有効。`anthropic` では無視される |
| `toolUse` | — | ツール使用の有効/無効。省略時: `anthropic`=true、`openai-compatible`=false、`bedrock-compatible`=true |

### 4. 環境変数参照

apiKey や headers の値に ${VAR_NAME} と書くと、実行時に環境変数の値に展開されます。

export YOUR_API_KEY="sk-xxxx"
export SERVICE_TOKEN="token-yyyy"

設定ファイルにシークレットを直書きせずに済みます。

## ライセンス

MIT
