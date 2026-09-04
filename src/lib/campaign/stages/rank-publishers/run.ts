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
import type { CampaignCatalogue, LockedPublisherStrategy, PipelineStageResult } from "../../types";

export async function rankPublisherStrategy(
  catalogue: CampaignCatalogue
): Promise<PipelineStageResult<LockedPublisherStrategy>> {
  const startedAt = Date.now();
  const payload = toPublisherRankingPayload(catalogue);
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
  const strategy = normalizePublisherStrategy(catalogue, result.data);
  const traceWarnings = stageLocalWarnings(strategy.warnings, catalogue.warnings);

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

function toPublisherRankingPayload(catalogue: CampaignCatalogue) {
  return {
    advertiserProfile: catalogue.advertiserProfile,
    publisherCatalogue: catalogue.publishers.map((publisher) => ({
      publisherId: publisher.id,
      name: publisher.name,
      category: publisher.category,
      subcategories: publisher.subcategories,
      monthlyImpressions: publisher.monthly_impressions,
      averageOrderValueUsd: publisher.avg_order_value_usd,
      audience: publisher.audience,
      notes: publisher.notes
    }))
  };
}
