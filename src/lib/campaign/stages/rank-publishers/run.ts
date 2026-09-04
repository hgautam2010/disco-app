import {
  getOpenAIModelForStage,
  getOpenAIRequestConfigForStage,
  toResponsesRequestConfig,
  toTraceRequestConfig
} from "../../shared/openaiClient";
import { readStagePrompt } from "../../shared/prompts";
import { generateAndValidateWithRepairResult, type RepairableStructuredRequest } from "../../shared/structuredGeneration";
import { stageLocalWarnings } from "../../shared/warnings";
import { normalizePublisherStrategy } from "./normalize";
import { publisherRankingResponseJsonSchema, publisherRankingResponseSchema } from "./schema";
import type { CampaignCandidates, LockedPublisherStrategy, PipelineStageResult } from "../../types";

export async function rankPublisherStrategy(
  candidates: CampaignCandidates
): Promise<PipelineStageResult<LockedPublisherStrategy>> {
  const startedAt = Date.now();
  const payload = toPublisherRankingPayload(candidates);
  const requestConfig = getOpenAIRequestConfigForStage("rank_publishers");
  const request: RepairableStructuredRequest = {
    model: getOpenAIModelForStage("rank_publishers"),
    ...toResponsesRequestConfig(requestConfig),
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
  const traceWarnings = stageLocalWarnings(strategy.warnings, candidates.warnings);

  return {
    data: strategy,
    trace: {
      name: "rank_publishers",
      source: "openai",
      model: result.model,
      requestConfig: toTraceRequestConfig(requestConfig, result.serviceTier),
      promptInput: payload,
      modelOutput: result.data,
      stageOutput: {
        recommendedPublishers: strategy.recommendedPublishers,
        excludedPublishers: strategy.excludedPublishers,
        warnings: traceWarnings
      },
      durationMs: Date.now() - startedAt,
      apiCalls: result.apiCalls,
      attempts: result.attempts,
      tokenUsage: result.tokenUsage,
      repaired: result.repaired,
      warnings: traceWarnings
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
