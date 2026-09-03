import type { TokenUsage } from "../../types";

export function emptyTokenUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    reasoningOutputTokens: 0
  };
}

export function addTokenUsage(...items: TokenUsage[]): TokenUsage {
  return items.reduce<TokenUsage>(
    (total, item) => ({
      inputTokens: total.inputTokens + item.inputTokens,
      outputTokens: total.outputTokens + item.outputTokens,
      totalTokens: total.totalTokens + item.totalTokens,
      cachedInputTokens: total.cachedInputTokens + item.cachedInputTokens,
      reasoningOutputTokens: total.reasoningOutputTokens + item.reasoningOutputTokens
    }),
    emptyTokenUsage()
  );
}
