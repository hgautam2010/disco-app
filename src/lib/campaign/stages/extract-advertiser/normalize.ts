import type { AdvertiserAnalysis } from "../../../types";
import type { AdvertiserProfileResponse } from "./schema";

export function normalizeAdvertiserProfile(
  advertiserDescription: string,
  profile: AdvertiserProfileResponse
): AdvertiserAnalysis {
  return {
    originalDescription: advertiserDescription.trim(),
    category: profile.category,
    secondaryCategories: uniqueValues(profile.secondaryCategories).filter((category) => category !== profile.category),
    priceTier: profile.priceTier,
    audienceHints: cleanStringArray(profile.audienceHints),
    productSignals: uniqueValues(profile.productSignals),
    valuePropositions: cleanStringArray(profile.valuePropositions),
    purchaseModel: cleanText(profile.purchaseModel, "unknown"),
    likelyObjective: cleanText(profile.likelyObjective, "new customer acquisition"),
    ambiguityLevel: profile.ambiguityLevel,
    confidence: Math.max(0, Math.min(1, profile.confidence))
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

function cleanText(value: string, defaultValue: string) {
  const cleanValue = value.trim();
  return cleanValue || defaultValue;
}

function cleanStringArray(values: string[]) {
  const cleanValues = values.map((value) => value.trim()).filter(Boolean);
  return Array.from(new Set(cleanValues));
}

function uniqueValues<T extends string>(values: T[]) {
  return Array.from(new Set(values));
}
