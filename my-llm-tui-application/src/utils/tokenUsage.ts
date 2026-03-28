export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
}

export function createTokenUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0 };
}

export function addTokenUsage(base: TokenUsage, api: ApiUsage): TokenUsage {
  return {
    inputTokens: base.inputTokens + api.input_tokens,
    outputTokens: base.outputTokens + api.output_tokens,
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatTokenUsage(usage: TokenUsage): string {
  const total = usage.inputTokens + usage.outputTokens;
  return `In: ${formatNumber(usage.inputTokens)} / Out: ${formatNumber(usage.outputTokens)} / Total: ${formatNumber(total)}`;
}
