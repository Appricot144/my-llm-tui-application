# LLM Chat TUI 拡張提案書

## プロジェクトの現状分析

### 既存の優れた機能

現在の`llm-chat-tui`は以下の機能を持つ、高機能なターミナルベースのLLMチャットアプリケーションです：

- **多モード対応**: Chat/Coding/Debug/Reviewの4つの専門モード
- **エージェント機能**: ファイル探索・読み取り・検索・編集ツール
- **マルチプロバイダー**: Anthropic、OpenAI Compatible、Bedrock Compatibleに対応
- **ストリーミング表示**: リアルタイムレスポンス
- **トークン管理**: 使用量の追跡と表示
- **セキュリティ**: プロジェクトルート内でのファイルアクセス制限
- **設定管理**: グローバル・ローカル設定ファイル対応

### プロジェクトの強み

1. **技術的完成度の高さ**: TypeScript + React + Ink による堅牢な実装
2. **拡張性のある設計**: 設定ファイル分離、モジュラー構造
3. **実用的な機能セット**: 開発者向けに特化した機能群
4. **セキュリティ意識**: ファイルアクセスの適切な制限

## 拡張方針: 基本機能の不足点と解決策

### 1. 会話履歴の永続化機能

**現在の問題点**:
- 会話がセッション内でのみ保持される
- アプリ終了時に全ての履歴が失われる
- 過去の重要な会話を参照できない

**実装方針**:
```typescript
// セッション管理の基本構造
interface Session {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  mode: ChatMode;
  messages: Message[];
  metadata: {
    tokenUsage: TokenUsage;
    projectPath?: string;
  };
}
```

**変更が必要なファイル**:
- `src/types.ts`: Session型の追加
- `src/hooks/useChat.ts`: 履歴保存・読み込み機能
- `src/index.tsx`: セッション管理UI
- `src/utils/sessionManager.ts`: 新規作成

**主な機能**:
- セッション一覧表示・切り替え（Ctrl+N, Ctrl+O）
- 自動保存機能
- セッション検索・フィルタリング
- ~/.config/llm-tui/sessions/ での管理

### 2. カスタムプロンプトテンプレート機能

**現在の問題点**:
- 各モードのプロンプトが固定
- ユーザー固有のワークフローに対応できない
- プロジェクト特有の要件を反映できない

**実装方針**:
```yaml
# config.yaml の拡張例
prompts:
  chat:
    system: "あなたは親切なアシスタントです。"
    user_prefix: ""
  coding:
    system: "あなたは経験豊富な{language}開発者です。"
    templates:
      - name: "code_review"
        template: "以下のコードをレビューし、改善点を指摘してください：\n{code}"
      - name: "bug_fix"
        template: "以下のエラーを解決するコードを提案してください：\n{error}"
```

**変更が必要なファイル**:
- `src/config/config.ts`: prompts設定の追加
- `src/agent/prompts.ts`: 動的プロンプト読み込み
- `src/components/PromptTemplateSelector.tsx`: 新規作成

### 3. ファイル出力・エクスポート機能

**現在の問題点**:
- 会話内容を外部に保存できない
- 生成されたコードを直接ファイルに出力できない
- レポート生成機能がない

**実装方針**:
```typescript
interface ExportOptions {
  format: 'markdown' | 'text' | 'json';
  includeSystem: boolean;
  codeBlocksOnly: boolean;
  outputPath?: string;
}

class ConversationExporter {
  exportConversation(session: Session, options: ExportOptions): void;
  exportCodeBlocks(session: Session, outputDir: string): void;
  generateReport(session: Session, reportType: 'debug' | 'review'): string;
}
```

**変更が必要なファイル**:
- `src/utils/exporter.ts`: 新規作成
- `src/index.tsx`: エクスポートキーバインド追加
- `src/components/ExportDialog.tsx`: 新規作成

**主な機能**:
- 会話全体のMarkdown/テキスト/JSONエクスポート
- コードブロックの個別ファイル出力
- Debug/Reviewモード用レポート生成
- 設定可能な出力フォーマット

### 4. プラグイン・拡張システム

**現在の問題点**:
- 新しいツールやモードの追加が困難
- サードパーティ拡張ができない
- 組織固有のワークフローに対応しにくい

**実装方針**:
```typescript
interface Plugin {
  name: string;
  version: string;
  tools?: Tool[];
  modes?: ChatMode[];
  commands?: Command[];
  init?(context: PluginContext): void;
}

interface PluginContext {
  registerTool(tool: Tool): void;
  registerMode(mode: ChatMode): void;
  registerCommand(command: Command): void;
}
```

**変更が必要なファイル**:
- `src/plugins/pluginLoader.ts`: 新規作成
- `src/plugins/types.ts`: 新規作成
- `src/config/config.ts`: プラグイン設定追加
- `~/.config/llm-tui/plugins/`: ディレクトリ作成

**主な機能**:
- JavaScriptプラグインの動的読み込み
- カスタムツール・モード・コマンドの追加
- プラグイン管理コマンド
- プラグインAPI文書化

### 5. 検索・フィルタリング機能

**現在の問題点**:
- 長い会話での過去の内容を見つけにくい
- 特定の話題やコードを素早く参照できない
- 情報の整理・分類ができない

**実装方針**:
```typescript
interface SearchOptions {
  query: string;
  scope: 'all' | 'current' | 'session';
  type: 'message' | 'code' | 'mixed';
  dateRange?: [Date, Date];
  tags?: string[];
}

interface MessageTag {
  name: string;
  color: string;
  category: 'topic' | 'status' | 'priority';
}
```

**変更が必要なファイル**:
- `src/utils/searchEngine.ts`: 新規作成
- `src/components/SearchBar.tsx`: 新規作成
- `src/hooks/useSearch.ts`: 新規作成
- `src/types.ts`: 検索関連型の追加

**主な機能**:
- 全文検索（正規表現対応）
- メッセージのタグ付け・分類
- ブックマーク機能
- 高度なフィルタリング（日付、モード、プロバイダー等）

## 実装優先度とロードマップ

### フェーズ1（優先度：高）
**会話履歴の永続化機能**
- 期間: 1-2週間
- 影響: 大（日常使用の利便性向上）
- 実装難易度: 中

### フェーズ2（優先度：中-高）
**エクスポート機能**
- 期間: 1週間
- 影響: 中-大（成果物の活用性向上）
- 実装難易度: 低-中

### フェーズ3（優先度：中）
**カスタムプロンプトテンプレート**
- 期間: 1-2週間
- 影響: 中（カスタマイズ性向上）
- 実装難易度: 中

### フェーズ4（優先度：中）
**検索・フィルタリング機能**
- 期間: 2-3週間
- 影響: 中（使いやすさ向上）
- 実装難易度: 中-高

### フェーズ5（優先度：低-中）
**プラグインシステム**
- 期間: 3-4週間
- 影響: 長期的に大（拡張性）
- 実装難易度: 高

## 追加の改善提案

### UI/UX改善
- ヘルプシステムの充実
- キーバインドのカスタマイズ
- テーマ・カラー設定
- レスポンシブデザイン改善

### パフォーマンス改善
- 大量メッセージの仮想スクロール
- メモリ使用量の最適化
- 設定ファイルの遅延読み込み

### セキュリティ強化
- API キーの暗号化保存
- アクセスログの記録
- 送信内容の事前検証

### 開発者体験向上
- 単体テスト・E2Eテストの充実
- CI/CD パイプラインの整備
- 開発用デバッグモード

## 結論

現在の`llm-chat-tui`は技術的に非常に優秀な基盤を持っています。上記の拡張により、単なるチャットツールから「開発者の日常業務を支援する統合環境」へと進化可能です。

特に**会話履歴の永続化**は、コーディング支援ツールとしての価値を大幅に向上させる基本機能として、最優先で実装することを推奨します。

この拡張により、チーム開発での知識共有、長期プロジェクトでの継続的な支援、個人の学習記録管理など、より幅広い用途での活用が可能になるでしょう。