import { describe, expect, it } from "vitest";
import { generateDeterministicCampaign } from "@/lib/campaignEngine";
import { normalizeExecution } from "@/lib/openai/normalizeExecution";
import { assembleFinalCampaign } from "@/lib/pipeline/assembleFinalCampaign";
import { buildExecutionFallback } from "@/lib/pipeline/buildExecutionFallback";
import {
  deterministicPersonaStrategyFromCandidates,
  normalizePersonaStrategy
} from "@/lib/campaign/stages/select-personas/normalize";
import {
  deterministicPublisherStrategyFromCandidates,
  normalizePublisherStrategy
} from "@/lib/campaign/stages/rank-publishers/normalize";
import { retrieveCampaignCandidates } from "@/lib/campaign/stages/retrieve-candidates/run";
import { validateCampaignResult } from "@/lib/schemas";
import type { PublisherRankingResponse } from "@/lib/campaign/stages/rank-publishers/schema";
import type { PersonaSelectionResponse } from "@/lib/campaign/stages/select-personas/schema";
import type {
  ExecutionResponse,
} from "@/lib/validation/campaignSchemas";

describe("staged campaign normalization", () => {
  it("cleans publisher ranking IDs and fills required recommendations from retrieved candidates", () => {
    const description =
      "Premium dog supplements for senior pets with mobility support, sold as a monthly subscription.";
    const profile = generateDeterministicCampaign(description).advertiserAnalysis;
    const candidates = retrieveCampaignCandidates(profile).data;
    const knownRecommendedIds = candidates.publisherCandidates.map((item) => item.publisher.id);
    const knownExcludedIds = candidates.exclusionCandidates.map((item) => item.publisher.id);
    const ranking: PublisherRankingResponse = {
      recommendedPublishers: [
        strategyPublisher(knownRecommendedIds[0], 98),
        strategyPublisher(knownRecommendedIds[0], 92),
        strategyPublisher("pub_missing", 88),
        strategyPublisher(knownRecommendedIds[1], 84)
      ],
      excludedPublishers: [
        excludedPublisher(knownRecommendedIds[0], 10),
        excludedPublisher("pub_missing", 8),
        excludedPublisher(knownExcludedIds[0], 18),
        excludedPublisher(knownExcludedIds[1], 22)
      ],
      warnings: ["Model noted category overlap."]
    };

    const result = normalizePublisherStrategy(candidates, ranking);
    const recommendedIds = result.recommendedPublishers.map((item) => item.publisher.id);
    const excludedIds = result.excludedPublishers.map((item) => item.publisher.id);

    expect(recommendedIds).toContain(knownRecommendedIds[0]);
    expect(recommendedIds).not.toContain("pub_missing");
    expect(new Set(recommendedIds).size).toBe(recommendedIds.length);
    expect(excludedIds).not.toContain(knownRecommendedIds[0]);
    expect(result.recommendedPublishers.length).toBeGreaterThanOrEqual(3);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Dropped recommended publisher outside candidate set: pub_missing.",
        "Filled recommended publishers from deterministic candidate retrieval."
      ])
    );
  });

  it("cleans persona selection IDs and fills required personas from retrieved candidates", () => {
    const description =
      "Premium dog supplements for senior pets with mobility support, sold as a monthly subscription.";
    const profile = generateDeterministicCampaign(description).advertiserAnalysis;
    const candidates = retrieveCampaignCandidates(profile).data;
    const publisherStrategy = deterministicPublisherStrategyFromCandidates(candidates);
    const knownPersonaIds = candidates.personaCandidates.map((item) => item.persona.id);
    const selection: PersonaSelectionResponse = {
      selectedPersonas: [
        strategyPersona(knownPersonaIds[0], 95),
        strategyPersona("persona_missing", 90),
        strategyPersona(knownPersonaIds[1], 87)
      ],
      warnings: ["Model noted category overlap."]
    };

    const result = normalizePersonaStrategy(candidates, publisherStrategy, selection);
    const personaIds = result.selectedPersonas.map((item) => item.persona.id);

    expect(personaIds).toContain(knownPersonaIds[0]);
    expect(personaIds).not.toContain("persona_missing");
    expect(new Set(personaIds).size).toBe(personaIds.length);
    expect(result.selectedPersonas.length).toBeGreaterThanOrEqual(3);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Dropped persona outside candidate set: persona_missing.",
        "Filled selected personas from deterministic candidate retrieval."
      ])
    );
  });

  it("normalizes execution output against locked personas and recommended publishers", () => {
    const description =
      "Premium dog supplements for senior pets with mobility support, sold as a monthly subscription.";
    const profile = generateDeterministicCampaign(description).advertiserAnalysis;
    const candidates = retrieveCampaignCandidates(profile).data;
    const publisherStrategy = deterministicPublisherStrategyFromCandidates(candidates);
    const strategy = deterministicPersonaStrategyFromCandidates(candidates, publisherStrategy);
    const fallbackExecution = buildExecutionFallback(strategy);
    const selectedPersonaIds = strategy.selectedPersonas.map((item) => item.persona.id);
    const recommendedPublisherIds = strategy.recommendedPublishers.map((item) => item.publisher.id);
    const execution: ExecutionResponse = {
      creativeVariants: [
        creativeVariant(selectedPersonaIds[0], "Valid persona", "Senior pet care without the guesswork"),
        creativeVariant("persona_missing", "Missing persona", "This creative should be dropped"),
        creativeVariant("persona_also_missing", "Missing persona", "This creative should also be dropped")
      ],
      campaignConfig: {
        objective: "monthly subscription acquisition",
        budget: {
          totalUsd: 18000,
          dailyUsd: 600,
          allocation: [
            allocation(recommendedPublisherIds[0], 70),
            allocation(recommendedPublisherIds[1], 50),
            allocation("pub_missing", 20)
          ]
        },
        targeting: {
          categories: ["pet_health"],
          audienceAttributes: ["senior dog owners", "subscription buyers"],
          geos: ["nationwide"],
          excludedAttributes: ["bargain-only shoppers"]
        },
        placements: [
          placement(recommendedPublisherIds[0]),
          placement("pub_missing"),
          placement(recommendedPublisherIds[1])
        ],
        bidStrategy: {
          type: "premium_focus",
          rationale: "Prioritize high-intent pet wellness inventory."
        },
        measurement: {
          primaryKpi: "new subscriptions",
          secondaryKpis: ["conversion rate"]
        }
      },
      warnings: []
    };

    const normalizedExecution = normalizeExecution({ fallbackExecution, strategy, execution });
    const result = assembleFinalCampaign({
      generatedAt: new Date().toISOString(),
      strategy,
      execution: normalizedExecution,
      stageTraces: []
    });
    const allocationTotal = result.campaignConfig.budget.allocation.reduce(
      (total, item) => total + item.budgetPercent,
      0
    );
    const validPersonaIds = new Set(result.selectedPersonas.map((item) => item.persona.id));
    const validPublisherIds = new Set(result.recommendedPublishers.map((item) => item.publisher.id));

    expect(result.mode).toBe("openai_staged");
    expect(result.creativeVariants.length).toBeGreaterThanOrEqual(3);
    expect(result.creativeVariants.every((variant) => validPersonaIds.has(variant.personaId))).toBe(true);
    expect(result.campaignConfig.budget.allocation.every((item) => validPublisherIds.has(item.publisherId))).toBe(true);
    expect(result.campaignConfig.placements.every((item) => validPublisherIds.has(item.publisherId))).toBe(true);
    expect(allocationTotal).toBe(100);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Added fallback creative to keep 3 to 5 usable variants.",
        "Normalized budget allocation to sum to 100."
      ])
    );
    expect(validateCampaignResult(result)).toEqual([]);
  });
});

function strategyPublisher(publisherId: string, score = 90): PublisherRankingResponse["recommendedPublishers"][number] {
  return {
    publisherId,
    score,
    reasons: ["Strong catalog and audience fit."],
    risks: [],
    signals: [{ label: "Fit", detail: "Matches category and purchase intent.", weight: score }]
  };
}

function excludedPublisher(publisherId: string, score = 20): PublisherRankingResponse["excludedPublishers"][number] {
  return {
    publisherId,
    score,
    reason: "Lower fit than selected publishers.",
    signals: [{ label: "Low fit", detail: "Audience or context mismatch.", weight: score }]
  };
}

function strategyPersona(personaId: string, score = 90): PersonaSelectionResponse["selectedPersonas"][number] {
  return {
    personaId,
    score,
    reasons: ["Likely to respond to the offer."],
    risks: [],
    messagingAngles: ["trust", "routine"],
    signals: [{ label: "Persona fit", detail: "Matches audience hints.", weight: score }]
  };
}

function creativeVariant(personaId: string, personaName: string, headline: string) {
  return {
    id: `creative_${personaId}`,
    personaId,
    personaName,
    headline,
    body: "Monthly support for senior dogs, built for owners who want clear ingredients and an easier routine.",
    rationale: "Connects senior pet mobility needs to subscription convenience.",
    tone: "credible and warm"
  };
}

function allocation(publisherId: string, budgetPercent: number) {
  return {
    publisherId,
    publisherName: publisherId,
    budgetPercent,
    bidCpmUsd: 16,
    rationale: "Allocate budget to staged recommendation."
  };
}

function placement(publisherId: string) {
  return {
    publisherId,
    publisherName: publisherId,
    placementType: "native checkout recommendation",
    priority: "primary" as const
  };
}
