import { publisherRankingResponseJsonSchema } from "../schemas";
import type { CampaignStageTrace } from "../types";
import { getOpenAIModel, hasOpenAIKey } from "../openai/client";
import { buildPublisherRankingPrompt } from "../openai/prompts";
import {
  generateAndValidateWithRepairResult,
  StructuredGenerationError,
  type RepairableStructuredRequest
} from "../openai/repairResponse";
import { publisherRankingResponseSchema } from "../validation/campaignSchemas";
import {
  deterministicPublisherStrategyFromCandidates,
  normalizePublisherStrategy
} from "./normalizePublisherStrategy";
import type { CampaignCandidates, LockedPublisherStrategy, PipelineStageResult } from "./types";

export async function rankPublisherStrategy(
  candidates: CampaignCandidates
): Promise<PipelineStageResult<LockedPublisherStrategy>> {
  const startedAt = Date.now();

  if (!hasOpenAIKey()) {
    return deterministicPublisherRankingResult(candidates, startedAt, "OPENAI_API_KEY is not configured.");
  }

  const payload = toPublisherRankingPayload(candidates);
  const request: RepairableStructuredRequest = {
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: buildPublisherRankingPrompt()
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

  try {
    const result = await generateAndValidateWithRepairResult({
      label: "publisher_ranking",
      schema: publisherRankingResponseSchema,
      request,
      fallbackCandidates: payload
    });
    const strategy = normalizePublisherStrategy(candidates, result.data);

    return {
      data: strategy,
      trace: {
        name: "rank_publishers",
        source: "openai",
        durationMs: Date.now() - startedAt,
        apiCalls: result.apiCalls,
        repaired: result.repaired,
        warnings: strategy.warnings
      }
    };
  } catch (error) {
    const structuredError = error instanceof StructuredGenerationError ? error : null;
    const reason = error instanceof Error ? error.message : "OpenAI publisher ranking failed.";
    return deterministicPublisherRankingResult(
      candidates,
      startedAt,
      reason,
      structuredError?.apiCalls,
      structuredError?.repaired
    );
  }
}

function deterministicPublisherRankingResult(
  candidates: CampaignCandidates,
  startedAt: number,
  reason: string,
  apiCalls = 0,
  repaired = false
): PipelineStageResult<LockedPublisherStrategy> {
  const warning = `OpenAI publisher ranking unavailable; using deterministic publisher candidate order. ${reason}`;
  const strategy = {
    ...deterministicPublisherStrategyFromCandidates(candidates),
    warnings: Array.from(new Set([...candidates.warnings, warning]))
  };
  const trace: CampaignStageTrace = {
    name: "rank_publishers",
    source: hasOpenAIKey() ? "fallback" : "deterministic",
    durationMs: Date.now() - startedAt,
    apiCalls,
    repaired,
    warnings: strategy.warnings,
    fallbackReason: warning
  };

  return {
    data: strategy,
    trace
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
