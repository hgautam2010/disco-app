import { getOpenAIModel } from "../../shared/openaiClient";
import { readStagePrompt } from "../../shared/prompts";
import { generateAndValidateWithRepairResult, type RepairableStructuredRequest } from "../../shared/structuredGeneration";
import { normalizePublisherStrategy } from "./normalize";
import { publisherRankingResponseJsonSchema, publisherRankingResponseSchema } from "./schema";
import type { CampaignCandidates, LockedPublisherStrategy, PipelineStageResult } from "../../types";

export async function rankPublisherStrategy(
  candidates: CampaignCandidates
): Promise<PipelineStageResult<LockedPublisherStrategy>> {
  const startedAt = Date.now();
  const payload = toPublisherRankingPayload(candidates);
  const request: RepairableStructuredRequest = {
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: readStagePrompt("rank-publishers")
      },
      {
        role: "user",
        content: JSON.stringify(payload)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...publisherRankingResponseJsonSchema
      }
    }
  };

  const result = await generateAndValidateWithRepairResult({
    label: "publisher_ranking",
    schema: publisherRankingResponseSchema,
    request,
    repairContext: payload
  });
  const strategy = normalizePublisherStrategy(candidates, result.data);

  return {
    data: strategy,
    trace: {
      name: "rank_publishers",
      source: "openai",
      model: result.model,
      durationMs: Date.now() - startedAt,
      apiCalls: result.apiCalls,
      attempts: result.attempts,
      tokenUsage: result.tokenUsage,
      repaired: result.repaired,
      warnings: strategy.warnings
    }
  };
}

function toPublisherRankingPayload(candidates: CampaignCandidates) {
  return {
    advertiserProfile: candidates.advertiserProfile,
    publisherCandidates: candidates.publisherCandidates.map((item) => ({
      publisherId: item.publisher.id,
      name: item.publisher.name,
      score: item.score,
      category: item.publisher.category,
      subcategories: item.publisher.subcategories,
      monthlyImpressions: item.publisher.monthly_impressions,
      averageOrderValueUsd: item.publisher.avg_order_value_usd,
      audience: item.publisher.audience,
      notes: item.publisher.notes,
      deterministicReasons: item.reasons,
      deterministicRisks: item.risks,
      deterministicSignals: item.signals
    })),
    exclusionCandidates: candidates.exclusionCandidates.map((item) => ({
      publisherId: item.publisher.id,
      name: item.publisher.name,
      score: item.score,
      category: item.publisher.category,
      subcategories: item.publisher.subcategories,
      notes: item.publisher.notes,
      deterministicReason: item.reason,
      deterministicSignals: item.signals
    }))
  };
}
