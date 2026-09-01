import { describe, expect, it } from "vitest";
import { executionResponseSchema, strategyResponseSchema } from "@/lib/validation/campaignSchemas";

describe("campaign Zod schemas", () => {
  it("accepts valid staged strategy output", () => {
    expect(strategyResponseSchema.safeParse(validStrategyResponse()).success).toBe(true);
  });

  it("rejects out-of-contract strategy scores", () => {
    const response = validStrategyResponse();
    response.recommendedPublishers[0].score = 140;

    expect(strategyResponseSchema.safeParse(response).success).toBe(false);
  });

  it("rejects execution output with too few creatives", () => {
    const response = validExecutionResponse();
    response.creativeVariants = response.creativeVariants.slice(0, 2);

    expect(executionResponseSchema.safeParse(response).success).toBe(false);
  });
});

function validStrategyResponse() {
  return {
    advertiserAnalysis: {
      category: "pet_health",
      secondaryCategories: ["subscription"],
      priceTier: "premium",
      audienceHints: ["senior dog owners"],
      productSignals: ["mobility support"],
      valuePropositions: ["clear ingredients"],
      purchaseModel: "subscription",
      likelyObjective: "subscription acquisition",
      ambiguityLevel: "low",
      confidence: 0.9
    },
    recommendedPublishers: ["pub_001", "pub_002", "pub_003"].map((publisherId) => ({
      publisherId,
      score: 90,
      reasons: ["Strong fit."],
      risks: [],
      signals: [{ label: "Fit", detail: "Relevant audience.", weight: 90 }]
    })),
    excludedPublishers: ["pub_004", "pub_005", "pub_006"].map((publisherId) => ({
      publisherId,
      score: 20,
      reason: "Lower fit.",
      signals: [{ label: "Low fit", detail: "Less relevant audience.", weight: 20 }]
    })),
    selectedPersonas: ["persona_001", "persona_002", "persona_003"].map((personaId) => ({
      personaId,
      score: 88,
      reasons: ["Likely to respond."],
      risks: [],
      messagingAngles: ["trust"],
      signals: [{ label: "Persona fit", detail: "Matches audience hints.", weight: 88 }]
    })),
    warnings: []
  };
}

function validExecutionResponse() {
  return {
    creativeVariants: ["persona_001", "persona_002", "persona_003"].map((personaId) => ({
      id: `creative_${personaId}`,
      personaId,
      personaName: personaId,
      headline: "Senior pet support made simple",
      body: "A monthly wellness routine for owners who want clear ingredients and confident care.",
      rationale: "Connects subscription convenience with pet wellness.",
      tone: "credible and warm"
    })),
    campaignConfig: {
      objective: "subscription acquisition",
      budget: {
        totalUsd: 18000,
        dailyUsd: 600,
        allocation: ["pub_001", "pub_002", "pub_003"].map((publisherId) => ({
          publisherId,
          publisherName: publisherId,
          budgetPercent: 33,
          bidCpmUsd: 14,
          rationale: "Relevant inventory."
        }))
      },
      targeting: {
        categories: ["pet_health"],
        audienceAttributes: ["senior dog owners"],
        geos: ["nationwide"],
        excludedAttributes: []
      },
      placements: ["pub_001", "pub_002", "pub_003"].map((publisherId) => ({
        publisherId,
        publisherName: publisherId,
        placementType: "native checkout recommendation",
        priority: "primary"
      })),
      bidStrategy: {
        type: "premium_focus",
        rationale: "Prioritize strongest-fit publishers."
      },
      measurement: {
        primaryKpi: "new subscriptions",
        secondaryKpis: ["conversion rate"]
      }
    },
    warnings: []
  };
}
