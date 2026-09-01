import { personaSelectionResponseJsonSchema } from "../schemas";
import type { CampaignStageTrace } from "../types";
import { getOpenAIModel, hasOpenAIKey } from "../openai/client";
import { buildPersonaSelectionPrompt } from "../openai/prompts";
import {
  generateAndValidateWithRepairResult,
  StructuredGenerationError,
  type RepairableStructuredRequest
} from "../openai/repairResponse";
import { personaSelectionResponseSchema } from "../validation/campaignSchemas";
import { deterministicPersonaStrategyFromCandidates, normalizePersonaStrategy } from "./normalizePersonaStrategy";
import type {
  CampaignCandidates,
  LockedCampaignStrategy,
  LockedPublisherStrategy,
  PipelineStageResult
} from "./types";

export async function selectPersonaStrategy(
  candidates: CampaignCandidates,
  publisherStrategy: LockedPublisherStrategy
): Promise<PipelineStageResult<LockedCampaignStrategy>> {
  const startedAt = Date.now();

  if (!hasOpenAIKey()) {
    return deterministicPersonaSelectionResult(
      candidates,
      publisherStrategy,
      startedAt,
      "OPENAI_API_KEY is not configured."
    );
  }

  const payload = toPersonaSelectionPayload(candidates, publisherStrategy);
  const request: RepairableStructuredRequest = {
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: buildPersonaSelectionPrompt()
      },
      {
        role: "user",
        content: JSON.stringify(payload)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...personaSelectionResponseJsonSchema
      }
    }
  };

  try {
    const result = await generateAndValidateWithRepairResult({
      label: "persona_selection",
      schema: personaSelectionResponseSchema,
      request,
      fallbackCandidates: payload
    });
    const strategy = normalizePersonaStrategy(candidates, publisherStrategy, result.data);

    return {
      data: strategy,
      trace: {
        name: "select_personas",
        source: "openai",
        durationMs: Date.now() - startedAt,
        apiCalls: result.apiCalls,
        repaired: result.repaired,
        warnings: strategy.warnings
      }
    };
  } catch (error) {
    const structuredError = error instanceof StructuredGenerationError ? error : null;
    const reason = error instanceof Error ? error.message : "OpenAI persona selection failed.";
    return deterministicPersonaSelectionResult(
      candidates,
      publisherStrategy,
      startedAt,
      reason,
      structuredError?.apiCalls,
      structuredError?.repaired
    );
  }
}

function deterministicPersonaSelectionResult(
  candidates: CampaignCandidates,
  publisherStrategy: LockedPublisherStrategy,
  startedAt: number,
  reason: string,
  apiCalls = 0,
  repaired = false
): PipelineStageResult<LockedCampaignStrategy> {
  const warning = `OpenAI persona selection unavailable; using deterministic persona candidate order. ${reason}`;
  const baselineStrategy = deterministicPersonaStrategyFromCandidates(candidates, publisherStrategy);
  const strategy = {
    ...baselineStrategy,
    warnings: Array.from(new Set([...baselineStrategy.warnings, warning]))
  };
  const trace: CampaignStageTrace = {
    name: "select_personas",
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

function toPersonaSelectionPayload(candidates: CampaignCandidates, publisherStrategy: LockedPublisherStrategy) {
  return {
    advertiserProfile: candidates.advertiserProfile,
    recommendedPublishers: publisherStrategy.recommendedPublishers.map((item) => ({
      publisherId: item.publisher.id,
      name: item.publisher.name,
      score: item.score,
      category: item.publisher.category,
      subcategories: item.publisher.subcategories,
      audience: item.publisher.audience,
      notes: item.publisher.notes,
      reasons: item.reasons,
      risks: item.risks,
      signals: item.signals
    })),
    excludedPublishers: publisherStrategy.excludedPublishers.map((item) => ({
      publisherId: item.publisher.id,
      name: item.publisher.name,
      score: item.score,
      category: item.publisher.category,
      subcategories: item.publisher.subcategories,
      notes: item.publisher.notes,
      reason: item.reason,
      signals: item.signals
    })),
    personaCandidates: candidates.personaCandidates.map((item) => ({
      personaId: item.persona.id,
      name: item.persona.name,
      ageRange: item.persona.age_range,
      genderSkew: item.persona.gender_skew,
      description: item.persona.description,
      categoryAffinities: item.persona.category_affinities,
      priceSensitivity: item.persona.price_sensitivity,
      messagingPreferences: item.persona.messaging_preferences,
      disinterestedIn: item.persona.disinterested_in,
      typicalAovUsd: item.persona.typical_aov_usd,
      score: item.score,
      deterministicReasons: item.reasons,
      deterministicRisks: item.risks,
      deterministicMessagingAngles: item.messagingAngles,
      deterministicSignals: item.signals
    }))
  };
}
