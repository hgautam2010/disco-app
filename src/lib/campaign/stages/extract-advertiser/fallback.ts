import { analyzeAdvertiserDescription } from "../../../advertiserParser";
import type { AdvertiserAnalysis } from "../../../types";
import type { AdvertiserProfileResponse } from "./schema";

export function buildDeterministicAdvertiserProfile(advertiserDescription: string) {
  return analyzeAdvertiserDescription(advertiserDescription);
}

export function normalizeAdvertiserProfile(
  advertiserDescription: string,
  deterministicProfile: AdvertiserAnalysis,
  profile: AdvertiserProfileResponse
): AdvertiserAnalysis {
  return {
    originalDescription: advertiserDescription.trim(),
    category: cleanText(profile.category, deterministicProfile.category),
    secondaryCategories: cleanArray(profile.secondaryCategories, deterministicProfile.secondaryCategories),
    priceTier: profile.priceTier,
    audienceHints: cleanArray(profile.audienceHints, deterministicProfile.audienceHints),
    productSignals: cleanArray(profile.productSignals, deterministicProfile.productSignals),
    valuePropositions: cleanArray(profile.valuePropositions, deterministicProfile.valuePropositions),
    purchaseModel: cleanText(profile.purchaseModel, deterministicProfile.purchaseModel),
    likelyObjective: cleanText(profile.likelyObjective, deterministicProfile.likelyObjective),
    ambiguityLevel: profile.ambiguityLevel,
    confidence: Math.max(0, Math.min(1, profile.confidence))
  };
}

export function toProfileResponse(profile: AdvertiserAnalysis): AdvertiserProfileResponse {
  return {
    category: profile.category,
    secondaryCategories: profile.secondaryCategories,
    priceTier: profile.priceTier,
    audienceHints: profile.audienceHints,
    productSignals: profile.productSignals,
    valuePropositions: profile.valuePropositions,
    purchaseModel: profile.purchaseModel,
    likelyObjective: profile.likelyObjective,
    ambiguityLevel: profile.ambiguityLevel,
    confidence: profile.confidence
  };
}

export function extractionWarnings(profile: AdvertiserAnalysis) {
  const warnings: string[] = [];

  if (profile.ambiguityLevel === "high") {
    warnings.push("Advertiser extraction is low-confidence because the pitch is vague.");
  }

  if (profile.category === "unknown") {
    warnings.push("Advertiser category is unknown; downstream matching should stay conservative.");
  }

  return warnings;
}

function cleanText(value: string, fallback: string) {
  const cleanValue = value.trim();
  return cleanValue || fallback;
}

function cleanArray(values: string[], fallback: string[]) {
  const cleanValues = values.map((value) => value.trim()).filter(Boolean);
  return cleanValues.length > 0 ? Array.from(new Set(cleanValues)) : fallback;
}
