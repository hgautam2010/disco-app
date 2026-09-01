import type { CampaignResult } from "../../types";

export function withFallbackWarning(result: CampaignResult, message: string): CampaignResult {
  return {
    ...result,
    mode: "fallback",
    warnings: Array.from(new Set([...result.warnings, message]))
  };
}
