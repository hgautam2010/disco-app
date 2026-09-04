import {
  getOpenAIModelForStage,
  getOpenAIRequestConfigForStage,
  toResponsesRequestConfig,
  toTraceRequestConfig
} from "../../shared/openaiClient";
import { readStagePrompt } from "../../shared/prompts";
import { generateAndValidateWithRepairResult, type RepairableStructuredRequest } from "../../shared/structuredGeneration";
import { stageLocalWarnings } from "../../shared/warnings";
import { normalizePersonaStrategy } from "./normalize";
import { personaSelectionResponseJsonSchema, personaSelectionResponseSchema } from "./schema";
import type {
  CampaignCandidates,
  LockedCampaignStrategy,
  LockedPublisherStrategy,
  PipelineStageResult
} from "../../types";

export async function selectPersonaStrategy(
  candidates: CampaignCandidates,
  publisherStrategy: LockedPublisherStrategy
): Promise<PipelineStageResult<LockedCampaignStrategy>> {
  const startedAt = Date.now();
  const payload = toPersonaSelectionPayload(candidates, publisherStrategy);
  const requestConfig = getOpenAIRequestConfigForStage("select_personas");
  const request: RepairableStructuredRequest = {
    model: getOpenAIModelForStage("select_personas"),
    ...toResponsesRequestConfig(requestConfig),
    input: [
      {
        role: "system",
        content: readStagePrompt("select-personas")
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

  const result = await generateAndValidateWithRepairResult({
    label: "persona_selection",
    schema: personaSelectionResponseSchema,
    request,
    repairContext: payload
  });
  const strategy = normalizePersonaStrategy(candidates, publisherStrategy, result.data);
  const traceWarnings = stageLocalWarnings(strategy.warnings, [...publisherStrategy.warnings, ...candidates.warnings]);

  return {
    data: strategy,
    trace: {
      name: "select_personas",
      source: "openai",
      model: result.model,
      requestConfig: toTraceRequestConfig(requestConfig, result.serviceTier),
      promptInput: payload,
      modelOutput: result.data,
      stageOutput: {
        selectedPersonas: strategy.selectedPersonas,
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
