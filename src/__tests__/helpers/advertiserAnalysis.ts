import type { AdvertiserAnalysis } from "@/lib/types";

export function advertiserAnalysisFixture(overrides: Partial<AdvertiserAnalysis> = {}): AdvertiserAnalysis {
  return {
    originalDescription: "Premium dog food for senior dogs with vet-formulated joint support.",
    category: "pet_food",
    secondaryCategories: [],
    priceTier: "premium",
    audienceHints: ["pet owners"],
    productSignals: ["subscription", "premium", "science-backed"],
    valuePropositions: ["trusted product quality"],
    purchaseModel: "subscription",
    likelyObjective: "subscription acquisition",
    ambiguityLevel: "low",
    confidence: 0.86,
    ...overrides
  };
}
