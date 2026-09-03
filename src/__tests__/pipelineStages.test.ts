import { describe, expect, it } from "vitest";
import { analyzeAdvertiserDescription } from "@/lib/advertiserParser";
import { assembleFinalCampaign } from "@/lib/campaign/stages/assemble/run";
import { extractAdvertiserProfile } from "@/lib/campaign/stages/extract-advertiser/run";
import { buildExecutionFallback } from "@/lib/campaign/stages/generate-execution/fallback";
import { deterministicPublisherStrategyFromCandidates } from "@/lib/campaign/stages/rank-publishers/normalize";
import { rankPublisherStrategy } from "@/lib/campaign/stages/rank-publishers/run";
import { retrieveCampaignCandidates } from "@/lib/campaign/stages/retrieve-candidates/run";
import { deterministicPersonaStrategyFromCandidates } from "@/lib/campaign/stages/select-personas/normalize";
import { selectPersonaStrategy } from "@/lib/campaign/stages/select-personas/run";
import type { CampaignStageTrace } from "@/lib/types";

describe("production pipeline stages", () => {
  it("extracts with deterministic fallback when OpenAI is unavailable", async () => {
    await withoutOpenAIKey(async () => {
      const result = await extractAdvertiserProfile(
        "Premium dog food for senior dogs with vet-formulated joint support."
      );

      expect(result.data.category).toBe("pet_food");
      expect(result.trace.name).toBe("extract");
      expect(result.trace.source).toBe("deterministic");
      expect(result.trace.apiCalls).toBe(0);
    });
  });

  it("retrieves bounded candidates before model ranking", () => {
    const profile = analyzeAdvertiserDescription(
      "A sustainable activewear brand for women made from recycled ocean plastic."
    );
    const result = retrieveCampaignCandidates(profile);
    const publisherNames = result.data.publisherCandidates.map((item) => item.publisher.name);
    const personaNames = result.data.personaCandidates.map((item) => item.persona.name);

    expect(result.trace.name).toBe("retrieve");
    expect(result.trace.apiCalls).toBe(0);
    expect(result.data.publisherCandidates.length).toBeLessThanOrEqual(10);
    expect(result.data.personaCandidates.length).toBeLessThanOrEqual(8);
    expect(publisherNames).toContain("Stride & Stem");
    expect(personaNames).toContain("The Sustainability Buyer");
  });

  it("falls back to deterministic candidate order for publisher ranking without an OpenAI key", async () => {
    await withoutOpenAIKey(async () => {
      const profile = analyzeAdvertiserDescription("Custom Italian leather handbags at a $1,200 price point.");
      const candidates = retrieveCampaignCandidates(profile).data;
      const result = await rankPublisherStrategy(candidates);

      expect(result.trace.name).toBe("rank_publishers");
      expect(result.trace.source).toBe("deterministic");
      expect(result.trace.apiCalls).toBe(0);
      expect(result.data.recommendedPublishers[0].publisher.id).toBe(candidates.publisherCandidates[0].publisher.id);
    });
  });

  it("falls back to deterministic candidate order for persona selection without an OpenAI key", async () => {
    await withoutOpenAIKey(async () => {
      const profile = analyzeAdvertiserDescription("Custom Italian leather handbags at a $1,200 price point.");
      const candidates = retrieveCampaignCandidates(profile).data;
      const publisherStrategy = deterministicPublisherStrategyFromCandidates(candidates);
      const result = await selectPersonaStrategy(candidates, publisherStrategy);

      expect(result.trace.name).toBe("select_personas");
      expect(result.trace.source).toBe("deterministic");
      expect(result.trace.apiCalls).toBe(0);
      expect(result.data.selectedPersonas[0].persona.id).toBe(candidates.personaCandidates[0].persona.id);
    });
  });

  it("summarizes pipeline calls, repairs, and fallback stages during final assembly", () => {
    const profile = analyzeAdvertiserDescription("Non-alcoholic sparkling drink with adaptogens.");
    const candidates = retrieveCampaignCandidates(profile).data;
    const publisherStrategy = deterministicPublisherStrategyFromCandidates(candidates);
    const strategy = deterministicPersonaStrategyFromCandidates(candidates, publisherStrategy);
    const execution = buildExecutionFallback(strategy);
    const traces: CampaignStageTrace[] = [
      stageTrace("extract", "openai", 1, false),
      stageTrace("retrieve", "deterministic", 0, false),
      stageTrace("rank_publishers", "openai", 2, true),
      stageTrace("select_personas", "openai", 1, false),
      stageTrace("execute", "fallback", 1, false)
    ];

    const result = assembleFinalCampaign({
      generatedAt: new Date().toISOString(),
      strategy,
      execution,
      stageTraces: traces
    });

    expect(result.pipeline?.apiCallCount).toBe(5);
    expect(result.pipeline?.repairCount).toBe(1);
    expect(result.pipeline?.fallbackStages).toEqual(["execute"]);
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

async function withoutOpenAIKey<T>(callback: () => Promise<T>) {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    return await callback();
  } finally {
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
}

function stageTrace(
  name: CampaignStageTrace["name"],
  source: CampaignStageTrace["source"],
  apiCalls: number,
  repaired: boolean
): CampaignStageTrace {
  return {
    name,
    source,
    durationMs: 1,
    apiCalls,
    repaired,
    warnings: []
  };
}
