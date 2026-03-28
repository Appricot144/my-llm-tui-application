import type { Mode } from "../agent/prompts.ts";

const MODE_CYCLE: Mode[] = ["chat", "coding", "debug", "review"];

export const MODE_LABELS: Record<Mode, string> = {
  chat: "Chat Mode",
  coding: "Coding Mode",
  debug: "Debug Mode",
  review: "Review Mode",
};

export function nextMode(current: Mode): Mode {
  const index = MODE_CYCLE.indexOf(current);
  return MODE_CYCLE[(index + 1) % MODE_CYCLE.length]!;
}
