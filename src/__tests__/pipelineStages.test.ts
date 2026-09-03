import { describe, expect, it } from "vitest";
import { emptyTokenUsage } from "@/lib/campaign/shared/tokenUsage";
import { assembleFinalCampaign } from "@/lib/campaign/stages/assemble/run";
import { retrieveCampaignCandidates } from "@/lib/campaign/stages/retrieve-candidates/run";
import type { CampaignCandidates, CampaignExecution, LockedCampaignStrategy } from "@/lib/campaign/types";
import type { CampaignStageTrace } from "@/lib/types";
import { advertiserAnalysisFixture } from "./helpers/advertiserAnalysis";

describe("production pipeline stages", () => {
  it("retrieves bounded candidates before model ranking", () => {
    const profile = advertiserAnalysisFixture({
      originalDescription: "A sustainable activewear brand for women made from recycled ocean plastic.",
      category: "sustainable_apparel",
      priceTier: "premium",
      audienceHints: ["women", "sustainability-minded shoppers"],
      productSignals: ["sustainability", "value"],
      valuePropositions: ["specific sustainability benefit"]
    });
    const result = retrieveCampaignCandidates(profile);
    const publisherNames = result.data.publisherCandidates.map((item) => item.publisher.name);
    const personaNames = result.data.personaCandidates.map((item) => item.persona.name);

    expect(result.trace.name).toBe("retrieve");
    expect(result.trace.apiCalls).toBe(0);
    expect(result.trace.attempts).toBe(0);
    expect(result.trace.model).toBe("code");
    expect(result.trace.tokenUsage.totalTokens).toBe(0);
    expect(result.trace.promptInput).toMatchObject({
      advertiserProfile: profile,
      publisherCandidateLimit: 10,
      personaCandidateLimit: 8,
      exclusionCandidateLimit: 8
    });
    expect(result.trace.modelOutput).toBeNull();
    expect(result.trace.stageOutput).toMatchObject({
      publisherCandidates: result.data.publisherCandidates,
      personaCandidates: result.data.personaCandidates
    });
    expect(result.data.publisherCandidates.length).toBeLessThanOrEqual(10);
    expect(result.data.personaCandidates.length).toBeLessThanOrEqual(8);
    expect(publisherNames).toContain("Stride & Stem");
    expect(personaNames).toContain("The Sustainability Buyer");
  });

  it("summarizes pipeline calls and repairs during final assembly", () => {
    const profile = advertiserAnalysisFixture({
      originalDescription: "Non-alcoholic sparkling drink with adaptogens.",
      category: "functional_beverages",
      priceTier: "mid_market",
      audienceHints: ["health-conscious shoppers"],
      productSignals: ["science-backed"],
      valuePropositions: ["evidence-oriented product promise"],
      purchaseModel: "one-time purchase",
      likelyObjective: "new customer acquisition"
    });
    const candidates = retrieveCampaignCandidates(profile).data;
    const strategy = campaignStrategyFromCandidates(candidates);
    const execution = executionFromStrategy(strategy);
    const traces: CampaignStageTrace[] = [
      stageTrace("extract", "openai", 1, false),
      stageTrace("retrieve", "deterministic", 0, false),
      stageTrace("rank_publishers", "openai", 2, true),
      stageTrace("select_personas", "openai", 1, false),
      stageTrace("execute", "openai", 1, false)
    ];

    const result = assembleFinalCampaign({
      generatedAt: new Date().toISOString(),
      strategy,
      execution,
      stageTraces: traces
    });

    expect(result.pipeline?.apiCallCount).toBe(5);
    expect(result.pipeline?.attemptCount).toBe(5);
    expect(result.pipeline?.repairCount).toBe(1);
    expect(result.pipeline?.totalTokenUsage.totalTokens).toBe(500);
    expect(result.pipeline?.stages.map((stage) => stage.name)).toEqual([
      "extract",
      "retrieve",
      "rank_publishers",
      "select_personas",
      "execute",
      "assemble"
    ]);
  });
});

function stageTrace(
  name: CampaignStageTrace["name"],
  source: CampaignStageTrace["source"],
  apiCalls: number,
  repaired: boolean
): CampaignStageTrace {
  return {
    name,
    source,
    model: source === "openai" ? "gpt-5.1" : "code",
    promptInput: { stage: name },
    modelOutput: source === "openai" ? { stage: name } : null,
    stageOutput: { stage: name },
    durationMs: 1,
    apiCalls,
    attempts: apiCalls,
    tokenUsage: {
      ...emptyTokenUsage(),
      inputTokens: apiCalls * 70,
      outputTokens: apiCalls * 30,
      totalTokens: apiCalls * 100
    },
    repaired,
    warnings: []
  };
}

function campaignStrategyFromCandidates(candidates: CampaignCandidates): LockedCampaignStrategy {
  return {
    advertiserAnalysis: candidates.advertiserProfile,
    recommendedPublishers: candidates.publisherCandidates.slice(0, 3),
    excludedPublishers: candidates.exclusionCandidates.slice(0, 3),
    selectedPersonas: candidates.personaCandidates.slice(0, 3),
    warnings: candidates.warnings
  };
}

function executionFromStrategy(strategy: LockedCampaignStrategy): CampaignExecution {
  return {
    creativeVariants: strategy.selectedPersonas.map((item, index) => ({
      id: `creative_${index + 1}`,
      personaId: item.persona.id,
      personaName: item.persona.name,
      headline: `Campaign idea for ${item.persona.name}`.slice(0, 80),
      body: "Persona-specific copy aligned to the advertiser profile and selected publisher context.",
      rationale: "Matches the selected persona to the campaign objective.",
      tone: "clear"
    })),
    campaignConfig: {
      objective: "new customer acquisition",
      budget: {
        totalUsd: 15000,
        dailyUsd: 500,
        allocation: strategy.recommendedPublishers.map((item, index) => ({
          publisherId: item.publisher.id,
          publisherName: item.publisher.name,
          budgetPercent: index === 0 ? 40 : 30,
          bidCpmUsd: 12,
          rationale: "Budget follows selected publisher priority."
        }))
      },
      targeting: {
        categories: [strategy.advertiserAnalysis.category],
        audienceAttributes: strategy.advertiserAnalysis.audienceHints,
        geos: ["United States"],
        excludedAttributes: []
      },
      placements: strategy.recommendedPublishers.map((item, index) => ({
        publisherId: item.publisher.id,
        publisherName: item.publisher.name,
        placementType: "native checkout recommendation",
        priority: index === 0 ? "primary" : "test"
      })),
      bidStrategy: {
        type: "balanced_cpm",
        rationale: "Balance quality and reach across selected publishers."
      },
      measurement: {
        primaryKpi: "new customer conversion rate",
        secondaryKpis: ["click-through rate"]
      }
    },
    warnings: []
  };
}
