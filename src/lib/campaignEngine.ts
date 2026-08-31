import { analyzeAdvertiserDescription } from "./advertiserParser";
import { buildCampaignConfig } from "./campaignConfig";
import { generateFallbackCreative } from "./creativeGenerator";
import { getPersonas, getPublishers } from "./data";
import { scorePersonas, selectPersonas } from "./personaScoring";
import { scorePublishers } from "./publisherScoring";
import type { CampaignResult } from "./types";

export function generateDeterministicCampaign(advertiserDescription: string): CampaignResult {
  const generatedAt = new Date().toISOString();
  const analysis = analyzeAdvertiserDescription(advertiserDescription);
  const personas = getPersonas();
  const publishers = getPublishers();
  const scoredPersonas = scorePersonas(analysis, personas);
  const selectedPersonas = selectPersonas(scoredPersonas);
  const { recommendedPublishers, excludedPublishers } = scorePublishers(analysis, selectedPersonas, publishers);
  const creativeVariants = generateFallbackCreative(analysis, selectedPersonas);
  const campaignConfig = buildCampaignConfig(analysis, recommendedPublishers, selectedPersonas);

  return {
    mode: "fallback",
    generatedAt,
    advertiserAnalysis: analysis,
    recommendedPublishers,
    excludedPublishers,
    selectedPersonas,
    creativeVariants,
    campaignConfig,
    warnings: warningsFor(advertiserDescription, recommendedPublishers.length, analysis.ambiguityLevel)
  };
}

function warningsFor(description: string, recommendationCount: number, ambiguityLevel: string) {
  const warnings: string[] = [];

  if (description.trim().length < 12 || ambiguityLevel === "high") {
    warnings.push("Advertiser input is low-signal; recommendations should be treated as directional.");
  }

  if (recommendationCount < 3) {
    warnings.push("Catalog fit is narrow; test budget should stay conservative until more signals arrive.");
  }

  return warnings;
}
