import { rankingResponseJsonSchema } from "../schemas";
import type { CampaignStageTrace } from "../types";
import { getOpenAIModel, hasOpenAIKey } from "../openai/client";
import { buildRankingPrompt } from "../openai/prompts";
import {
  generateAndValidateWithRepairResult,
  StructuredGenerationError,
  type RepairableStructuredRequest
} from "../openai/repairResponse";
import { rankingResponseSchema } from "../validation/campaignSchemas";
import { deterministicStrategyFromCandidates, normalizeRankedStrategy } from "./normalizeRankedStrategy";
import type { CampaignCandidates, LockedCampaignStrategy, PipelineStageResult } from "./types";

export async function rankCampaignStrategy(
  candidates: CampaignCandidates
): Promise<PipelineStageResult<LockedCampaignStrategy>> {
  const startedAt = Date.now();

  if (!hasOpenAIKey()) {
    return deterministicRankingResult(candidates, startedAt, "OPENAI_API_KEY is not configured.");
  }

  const request: RepairableStructuredRequest = {
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: buildRankingPrompt()
      },
      {
        role: "user",
        content: JSON.stringify(toRankingPayload(candidates))
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...rankingResponseJsonSchema
      }
    }
  };

  try {
    const result = await generateAndValidateWithRepairResult({
      label: "campaign_ranking",
      schema: rankingResponseSchema,
      request,
      fallbackCandidates: toRankingPayload(candidates)
    });
    const strategy = normalizeRankedStrategy(candidates, result.data);

    return {
      data: strategy,
      trace: {
        name: "rank",
        source: "openai",
        durationMs: Date.now() - startedAt,
        apiCalls: result.apiCalls,
        repaired: result.repaired,
        warnings: strategy.warnings
      }
    };
  } catch (error) {
    const structuredError = error instanceof StructuredGenerationError ? error : null;
    const reason = error instanceof Error ? error.message : "OpenAI ranking failed.";
    return deterministicRankingResult(candidates, startedAt, reason, structuredError?.apiCalls, structuredError?.repaired);
  }
}

function deterministicRankingResult(
  candidates: CampaignCandidates,
  startedAt: number,
  reason: string,
  apiCalls = 0,
  repaired = false
): PipelineStageResult<LockedCampaignStrategy> {
  const warning = `OpenAI ranking unavailable; using deterministic candidate order. ${reason}`;
  const strategy = {
    ...deterministicStrategyFromCandidates(candidates),
    warnings: Array.from(new Set([...candidates.warnings, warning]))
  };
  const trace: CampaignStageTrace = {
    name: "rank",
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

function toRankingPayload(candidates: CampaignCandidates) {
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
    personaCandidates: candidates.personaCandidates.map((item) => ({
      personaId: item.persona.id,
      name: item.persona.name,
      score: item.score,
      ageRange: item.persona.age_range,
      genderSkew: item.persona.gender_skew,
      description: item.persona.description,
      categoryAffinities: item.persona.category_affinities,
      priceSensitivity: item.persona.price_sensitivity,
      messagingPreferences: item.persona.messaging_preferences,
      disinterestedIn: item.persona.disinterested_in,
      typicalAovUsd: item.persona.typical_aov_usd,
      deterministicReasons: item.reasons,
      deterministicRisks: item.risks,
      deterministicMessagingAngles: item.messagingAngles,
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
