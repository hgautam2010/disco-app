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
  CampaignCatalogue,
  LockedCampaignStrategy,
  LockedPublisherStrategy,
  PipelineStageResult
} from "../../types";

export async function selectPersonaStrategy(
  catalogue: CampaignCatalogue,
  publisherStrategy: LockedPublisherStrategy
): Promise<PipelineStageResult<LockedCampaignStrategy>> {
  const startedAt = Date.now();
  const payload = toPersonaSelectionPayload(catalogue, publisherStrategy);
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
  const strategy = normalizePersonaStrategy(catalogue, publisherStrategy, result.data);
  const traceWarnings = stageLocalWarnings(strategy.warnings, [...publisherStrategy.warnings, ...catalogue.warnings]);

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

function toPersonaSelectionPayload(catalogue: CampaignCatalogue, publisherStrategy: LockedPublisherStrategy) {
  const publisherPayload = {
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
    }))
  };

  return {
    advertiserProfile: catalogue.advertiserProfile,
    ...publisherPayload,
    personaCatalogue: catalogue.personas.map((persona) => ({
      personaId: persona.id,
      name: persona.name,
      ageRange: persona.age_range,
      genderSkew: persona.gender_skew,
      description: persona.description,
      categoryAffinities: persona.category_affinities,
      priceSensitivity: persona.price_sensitivity,
      messagingPreferences: persona.messaging_preferences,
      disinterestedIn: persona.disinterested_in,
      typicalAovUsd: persona.typical_aov_usd
    }))
  };
}
