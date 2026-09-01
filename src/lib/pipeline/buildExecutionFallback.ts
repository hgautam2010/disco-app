import { buildCampaignConfig } from "../campaignConfig";
import { generateFallbackCreative } from "../creativeGenerator";
import type { CampaignExecution, LockedCampaignStrategy } from "./types";

export function buildExecutionFallback(strategy: LockedCampaignStrategy): CampaignExecution {
  return {
    creativeVariants: generateFallbackCreative(strategy.advertiserAnalysis, strategy.selectedPersonas),
    campaignConfig: buildCampaignConfig(
      strategy.advertiserAnalysis,
      strategy.recommendedPublishers,
      strategy.selectedPersonas
    ),
    warnings: []
  };
}
