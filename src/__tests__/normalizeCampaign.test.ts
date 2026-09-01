import { describe, expect, it } from "vitest";
import { generateDeterministicCampaign } from "@/lib/campaignEngine";
import { getPersonas, getPublishers } from "@/lib/data";
import { normalizeInlineCampaignDraft, type InlineCampaignDraft } from "@/lib/openai/normalizeCampaign";
import { validateCampaignResult } from "@/lib/schemas";

describe("inline campaign normalization", () => {
  it("repairs model output while preserving catalog-backed recommendations", () => {
    const description =
      "We sell premium dog food for senior dogs, targeting owners who care about joint health and longevity.";
    const baseline = generateDeterministicCampaign(description);
    const draft: InlineCampaignDraft = {
      advertiserAnalysis: {
        category: "pet_food",
        secondaryCategories: ["pet_health"],
        priceTier: "premium",
        audienceHints: ["senior dog owners"],
        productSignals: ["vet-formulated"],
        valuePropositions: ["health-conscious nutrition"],
        purchaseModel: "subscription",
        likelyObjective: "subscription acquisition",
        ambiguityLevel: "low",
        confidence: 0.88
      },
      recommendedPublishers: [
        {
          publisherId: "pub_007",
          score: 95,
          reasons: ["Best health-conscious pet subscription fit."],
          risks: [],
          signals: []
        },
        {
          publisherId: "pub_007",
          score: 91,
          reasons: ["Duplicate should be removed."],
          risks: [],
          signals: []
        },
        {
          publisherId: "pub_missing",
          score: 80,
          reasons: ["Unknown publisher should be removed."],
          risks: [],
          signals: []
        }
      ],
      excludedPublishers: [
        {
          publisherId: "pub_007",
          score: 15,
          reason: "Overlap should be removed.",
          signals: []
        },
        {
          publisherId: "pub_013",
          score: 12,
          reason: "Beauty context is not a pet-health fit.",
          signals: []
        },
        {
          publisherId: "pub_missing",
          score: 5,
          reason: "Unknown publisher should be removed.",
          signals: []
        }
      ],
      selectedPersonas: [
        {
          personaId: "persona_004",
          score: 94,
          reasons: ["Pet health buyer fit."],
          risks: [],
          messagingAngles: ["vet-recommended", "ingredient transparency"],
          signals: []
        },
        {
          personaId: "persona_missing",
          score: 90,
          reasons: ["Unknown persona should be removed."],
          risks: [],
          messagingAngles: [],
          signals: []
        }
      ],
      creativeVariants: [
        {
          id: "creative_01",
          personaId: "persona_004",
          personaName: "The Pet Parent",
          headline: "Senior dog nutrition with proof behind it",
          body: "Vet-formulated food for pet parents who read the label and want a dependable senior-dog routine.",
          rationale: "Tailored to ingredient-focused pet parents.",
          tone: "credible and warm"
        },
        {
          id: "creative_bad",
          personaId: "persona_missing",
          personaName: "Missing",
          headline: "Should be removed",
          body: "This persona does not exist.",
          rationale: "Invalid.",
          tone: "invalid"
        }
      ],
      campaignConfig: {
        objective: "subscription acquisition",
        budget: {
          totalUsd: 14000,
          dailyUsd: 467,
          allocation: [
            {
              publisherId: "pub_007",
              publisherName: "Pawline",
              budgetPercent: 55,
              bidCpmUsd: 18,
              rationale: "Primary pet-health fit."
            }
          ]
        },
        targeting: {
          categories: ["pet_food", "pet_health"],
          audienceAttributes: ["senior dog owners"],
          geos: ["nationwide"],
          excludedAttributes: ["generic pet brands"]
        },
        placements: [
          {
            publisherId: "pub_007",
            publisherName: "Pawline",
            placementType: "native checkout recommendation",
            priority: "primary"
          }
        ],
        bidStrategy: {
          type: "premium_focus",
          rationale: "Pay more for matched pet-health context."
        },
        measurement: {
          primaryKpi: "new subscriptions",
          secondaryKpis: ["conversion rate"]
        }
      },
      warnings: []
    };

    const result = normalizeInlineCampaignDraft(description, baseline, draft, getPublishers(), getPersonas());
    const recommendedIds = result.recommendedPublishers.map((item) => item.publisher.id);
    const excludedIds = result.excludedPublishers.map((item) => item.publisher.id);
    const budgetTotal = result.campaignConfig.budget.allocation.reduce(
      (total, allocation) => total + allocation.budgetPercent,
      0
    );

    expect(result.mode).toBe("openai_inline");
    expect(recommendedIds).toContain("pub_007");
    expect(recommendedIds).not.toContain("pub_missing");
    expect(new Set(recommendedIds).size).toBe(recommendedIds.length);
    expect(excludedIds).not.toContain("pub_007");
    expect(result.selectedPersonas.length).toBeGreaterThanOrEqual(3);
    expect(result.creativeVariants.length).toBeGreaterThanOrEqual(3);
    expect(budgetTotal).toBe(100);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Dropped unknown recommended publisher id: pub_missing.",
        "Dropped unknown persona id: persona_missing.",
        "Normalized budget allocation to sum to 100."
      ])
    );
    expect(validateCampaignResult(result)).toEqual([]);
  });
});
