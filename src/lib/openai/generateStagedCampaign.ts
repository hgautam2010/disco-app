import type { CampaignStageTrace } from "../types";
import { assembleFinalCampaign } from "../pipeline/assembleFinalCampaign";
import { buildExecutionFallback } from "../pipeline/buildExecutionFallback";
import { extractAdvertiserProfile } from "../campaign/stages/extract-advertiser/run";
import { rankPublisherStrategy } from "../campaign/stages/rank-publishers/run";
import { retrieveCampaignCandidates } from "../campaign/stages/retrieve-candidates/run";
import { selectPersonaStrategy } from "../pipeline/selectPersonaStrategy";
import type { CampaignExecution, LockedCampaignStrategy, PipelineStageResult } from "../pipeline/types";
import { hasOpenAIKey } from "../campaign/shared/openaiClient";
import { generateExecutionWithMetadata } from "./generateExecution";
import { normalizeExecution } from "./normalizeExecution";

export async function generateStagedOpenAICampaign(advertiserDescription: string) {
  const generatedAt = new Date().toISOString();
  const extraction = await extractAdvertiserProfile(advertiserDescription);
  const candidates = retrieveCampaignCandidates(extraction.data);
  const publisherStrategy = await rankPublisherStrategy(candidates.data);
  const strategy = await selectPersonaStrategy(candidates.data, publisherStrategy.data);
  const execution = await generateExecutionStage(advertiserDescription, strategy.data);

  return assembleFinalCampaign({
    generatedAt,
    strategy: strategy.data,
    execution: execution.data,
    stageTraces: [extraction.trace, candidates.trace, publisherStrategy.trace, strategy.trace, execution.trace]
  });
}

async function generateExecutionStage(
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
