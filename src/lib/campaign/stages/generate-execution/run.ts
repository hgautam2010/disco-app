import { getPersonas, getPublishers } from "../../../data";
import type { CampaignStageTrace } from "../../../types";
import { getOpenAIModel, hasOpenAIKey } from "../../shared/openaiClient";
import { readStagePrompt } from "../../shared/prompts";
import {
  generateAndValidateWithRepairResult,
  type RepairableStructuredRequest,
  type StructuredGenerationResult
} from "../../shared/structuredGeneration";
import type { CampaignExecution, LockedCampaignStrategy, PipelineStageResult } from "../../types";
import { buildExecutionFallback } from "./fallback";
import { normalizeExecution } from "./normalize";
import { executionResponseJsonSchema, executionResponseSchema, type ExecutionResponse } from "./schema";

export async function generateExecutionStage(
  advertiserDescription: string,
  strategy: LockedCampaignStrategy
): Promise<PipelineStageResult<CampaignExecution>> {
  const startedAt = Date.now();
  const fallbackExecution = buildExecutionFallback(strategy);

  if (!hasOpenAIKey()) {
    return fallbackExecutionStage(startedAt, fallbackExecution, "OPENAI_API_KEY is not configured.", 0, false);
  }

  try {
    const result = await generateExecutionWithMetadata(advertiserDescription, strategy);
    const execution = normalizeExecution({
      fallbackExecution,
      strategy,
      execution: result.data
    });

    return {
      data: execution,
      trace: {
        name: "execute",
        source: "openai",
        durationMs: Date.now() - startedAt,
        apiCalls: result.apiCalls,
        repaired: result.repaired,
        warnings: execution.warnings
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI execution failed.";
    const apiCalls = hasApiCallMetadata(error) ? error.apiCalls : 1;
    const repaired = hasApiCallMetadata(error) ? error.repaired : false;
    return fallbackExecutionStage(startedAt, fallbackExecution, message, apiCalls, repaired);
  }
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
        content: readStagePrompt("generate-execution")
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

function fallbackExecutionStage(
  startedAt: number,
  fallbackExecution: CampaignExecution,
  reason: string,
  apiCalls: number,
  repaired: boolean
): PipelineStageResult<CampaignExecution> {
  const warning = `OpenAI execution unavailable; using deterministic creative and config. ${reason}`;
  const trace: CampaignStageTrace = {
    name: "execute",
    source: hasOpenAIKey() ? "fallback" : "deterministic",
    durationMs: Date.now() - startedAt,
    apiCalls,
    repaired,
    warnings: [warning],
    fallbackReason: warning
  };

  return {
    data: {
      ...fallbackExecution,
      warnings: [warning]
    },
    trace
  };
}

function hasApiCallMetadata(error: unknown): error is { apiCalls: number; repaired: boolean } {
  return (
    typeof error === "object" &&
    error !== null &&
    "apiCalls" in error &&
    "repaired" in error &&
    typeof error.apiCalls === "number" &&
    typeof error.repaired === "boolean"
  );
}
