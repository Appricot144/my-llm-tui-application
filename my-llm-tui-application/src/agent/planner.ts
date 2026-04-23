import type { LLMProvider } from "../providers/types.ts";

// ========================================================
// 定数
// ========================================================

export const PLANNING_MAX_TOKENS = 512;
export const PLANNING_MAX_TASKS = 5;
export const PLANNING_TITLE_MAX_LENGTH = 15;
export const PLANNING_TARGET_TASKS_MIN = 2;
export const PLANNING_TARGET_TASKS_MAX = 3;

// ========================================================
// 型定義
// ========================================================

export interface PlanTask {
  title: string;
  detail: string;
}

export interface TaskPlan {
  tasks: PlanTask[];
}

export interface PlanningResult {
  plan: TaskPlan;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

const FALLBACK_PLAN = (userMessage: string): TaskPlan => ({
  tasks: [{ title: "タスク実行", detail: userMessage }],
});

// ========================================================
// getPlanningPrompt
// ========================================================

export function getPlanningPrompt(): string {
  return [
    "あなたはタスク分解の専門家です。",
    "ユーザーの依頼を具体的なサブタスクに分解し、以下のJSON形式のみを返してください。",
    "テキストは一切含めず、JSONのみを返すこと。",
    "",
    '{"tasks":[{"title":"タスク名","detail":"具体的な作業内容"}]}',
    "",
    "ルール:",
    `- タスクに分解する実益がない場合（単一の具体的操作など）は {"tasks":[]} を返すこと`,
    `- タスク数は必要最低限。目安は${PLANNING_TARGET_TASKS_MIN}〜${PLANNING_TARGET_TASKS_MAX}件、最大${PLANNING_MAX_TASKS}件`,
    `- titleは${PLANNING_TITLE_MAX_LENGTH}文字以内`,
    "- detailは対象ファイルや手順を含む具体的な内容",
    "- テスト実行・確認・ドキュメント更新は実装タスクに含め、独立したタスクにしないこと",
  ].join("\n");
}

// ========================================================
// needsPlanning
// ========================================================

export function needsPlanning(message: string): boolean {
  const lines = message.split("\n").map((l) => l.trim()).filter(Boolean);

  const numberedItems = lines.filter((l) => /^\d+[\.\)]\s+\S/.test(l));
  if (numberedItems.length >= 2) return false;

  const bulletItems = lines.filter((l) => /^[-*]\s+\S/.test(l));
  if (bulletItems.length >= 2) return false;

  return true;
}

// ========================================================
// planTasks
// ========================================================

export async function planTasks(
  provider: LLMProvider,
  model: string,
  userMessage: string,
): Promise<PlanningResult> {
  const response = await provider.streamMessage(
    {
      model,
      maxTokens: PLANNING_MAX_TOKENS,
      system: getPlanningPrompt(),
      messages: [{ role: "user", content: userMessage }],
    },
    () => {}
  );

  const tokenUsage = {
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
  };

  const text = response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");

  const plan = parsePlan(text, userMessage);
  return { plan, tokenUsage };
}

// ========================================================
// 内部ヘルパー
// ========================================================

export function parsePlan(text: string, userMessage: string): TaskPlan {
  const trimmed = text.trim();
  const jsonStr = extractJson(trimmed);
  if (!jsonStr) return FALLBACK_PLAN(userMessage);

  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    if (isValidTaskPlan(parsed)) return parsed;
  } catch {
    // パース失敗はフォールバック
  }
  return FALLBACK_PLAN(userMessage);
}

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1]?.trim() ?? null;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}

function isValidTaskPlan(value: unknown): value is TaskPlan {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj["tasks"])) return false;
  return obj["tasks"].every(
    (t) =>
      typeof t === "object" &&
      t !== null &&
      typeof (t as Record<string, unknown>)["title"] === "string" &&
      typeof (t as Record<string, unknown>)["detail"] === "string"
  );
}
