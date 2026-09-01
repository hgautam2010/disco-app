import { getPersonas, getPublishers } from "../data";
import type { LockedCampaignStrategy } from "../pipeline/types";
import { executionResponseJsonSchema } from "../schemas";
import { executionResponseSchema, type ExecutionResponse } from "../validation/campaignSchemas";
import { getOpenAIModel } from "../campaign/shared/openaiClient";
import { buildExecutionPrompt } from "./prompts";
import {
  generateAndValidateWithRepairResult,
  type RepairableStructuredRequest,
  type StructuredGenerationResult
} from "../campaign/shared/structuredGeneration";

export async function generateExecution(
  advertiserDescription: string,
  strategy: LockedCampaignStrategy
): Promise<ExecutionResponse> {
  return (await generateExecutionWithMetadata(advertiserDescription, strategy)).data;
}

export async function generateExecutionWithMetadata(
  advertiserDescription: string,
  strategy: LockedCampaignStrategy
): Promise<StructuredGenerationResult<ExecutionResponse>> {
  const publishers = getPublishers();
  const personas = getPersonas();
  const strategyPayload = {
    advertiserAnalysis: strategy.advertiserAnalysis,
    recommendedPublishers: strategy.recommendedPublishers.map((item) => ({
      publisherId: item.publisher.id,
      publisherName: item.publisher.name,
      score: item.score,
      reasons: item.reasons,
      risks: item.risks
    })),
    excludedPublishers: strategy.excludedPublishers.map((item) => ({
      publisherId: item.publisher.id,
      publisherName: item.publisher.name,
      score: item.score,
      reason: item.reason
    })),
    selectedPersonas: strategy.selectedPersonas.map((item) => ({
      personaId: item.persona.id,
      personaName: item.persona.name,
      score: item.score,
      reasons: item.reasons,
      risks: item.risks,
      messagingAngles: item.messagingAngles
    })),
    warnings: strategy.warnings
  };
  const recommendedPublisherIds = new Set(strategy.recommendedPublishers.map((item) => item.publisher.id));
  const excludedPublisherIds = new Set(strategy.excludedPublishers.map((item) => item.publisher.id));
  const selectedPersonaIds = new Set(strategy.selectedPersonas.map((item) => item.persona.id));
  const recommendedPublishers = publishers.filter((publisher) => recommendedPublisherIds.has(publisher.id));
  const excludedPublishers = publishers.filter((publisher) => excludedPublisherIds.has(publisher.id));
  const selectedPersonas = personas.filter((persona) => selectedPersonaIds.has(persona.id));
  const request: RepairableStructuredRequest = {
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: buildExecutionPrompt()
      },
      {
        role: "user",
        content: JSON.stringify({
          advertiserDescription,
          strategy: strategyPayload,
          recommendedPublishers,
          excludedPublishers,
          selectedPersonas
        })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...executionResponseJsonSchema
      }
    }
  };

  return generateAndValidateWithRepairResult({
    label: "execution",
    schema: executionResponseSchema,
    request,
    fallbackCandidates: {
      strategy: strategyPayload,
      recommendedPublishers,
      excludedPublishers,
      selectedPersonas
    }
  });
}
