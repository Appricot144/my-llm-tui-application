import type { LLMProvider } from "../providers/types.ts";
import { getPlanningPrompt } from "./prompts.ts";

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

const PLANNING_MAX_TOKENS = 512;

const FALLBACK_PLAN = (userMessage: string): TaskPlan => ({
  tasks: [{ title: "タスク実行", detail: userMessage }],
});

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
  // コードブロックに包まれたJSONを除去する
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
