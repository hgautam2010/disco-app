import { getOpenAIModel } from "../../shared/openaiClient";
import { readStagePrompt } from "../../shared/prompts";
import { generateAndValidateWithRepairResult, type RepairableStructuredRequest } from "../../shared/structuredGeneration";
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
  const request: RepairableStructuredRequest = {
    model: getOpenAIModel(),
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
