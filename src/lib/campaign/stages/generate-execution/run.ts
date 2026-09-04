import { getPersonas, getPublishers } from "../../../data";
import {
  getOpenAIModelForStage,
  getOpenAIRequestConfigForStage,
  toResponsesRequestConfig,
  toTraceRequestConfig
} from "../../shared/openaiClient";
import { readStagePrompt } from "../../shared/prompts";
import {
  generateAndValidateWithRepairResult,
  type RepairableStructuredRequest,
  type StructuredGenerationResult
} from "../../shared/structuredGeneration";
import { stageLocalWarnings } from "../../shared/warnings";
import type { CampaignExecution, LockedCampaignStrategy, PipelineStageResult } from "../../types";
import { normalizeExecution } from "./normalize";
import { executionResponseJsonSchema, executionResponseSchema, type ExecutionResponse } from "./schema";

export async function generateExecutionStage(
  advertiserDescription: string,
  strategy: LockedCampaignStrategy
): Promise<PipelineStageResult<CampaignExecution>> {
  const startedAt = Date.now();
  const payload = toExecutionPayload(advertiserDescription, strategy);
  const requestConfig = getOpenAIRequestConfigForStage("execute");
  const result = await generateExecutionForPayload(payload, requestConfig);
  const execution = normalizeExecution({
    strategy,
    execution: result.data
  });
  const traceWarnings = stageLocalWarnings(execution.warnings, strategy.warnings);

  return {
    data: execution,
    trace: {
      name: "execute",
      source: "openai",
      model: result.model,
      requestConfig: toTraceRequestConfig(requestConfig, result.serviceTier),
      promptInput: payload,
      modelOutput: result.data,
      stageOutput: {
        creativeVariants: execution.creativeVariants,
        campaignConfig: execution.campaignConfig,
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
  return generateExecutionForPayload(toExecutionPayload(advertiserDescription, strategy));
}

function toExecutionPayload(advertiserDescription: string, strategy: LockedCampaignStrategy) {
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

  return {
    advertiserDescription,
    strategy: strategyPayload,
    recommendedPublishers,
    excludedPublishers,
    selectedPersonas
  };
}

function generateExecutionForPayload(
  payload: ReturnType<typeof toExecutionPayload>,
  requestConfig = getOpenAIRequestConfigForStage("execute")
) {
  const request: RepairableStructuredRequest = {
    model: getOpenAIModelForStage("execute"),
    ...toResponsesRequestConfig(requestConfig),
    input: [
      {
        role: "system",
        content: readStagePrompt("generate-execution")
      },
      {
        role: "user",
        content: JSON.stringify(payload)
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
    repairContext: payload
  });
}
