import { validateCampaignResult } from "../../../schemas";
import type { CampaignPipelineTrace, CampaignResult, CampaignStageTrace } from "../../../types";
import type { CampaignExecution, LockedCampaignStrategy } from "../../types";

export function assembleFinalCampaign({
  generatedAt,
  strategy,
  execution,
  stageTraces
}: {
  generatedAt: string;
  strategy: LockedCampaignStrategy;
  execution: CampaignExecution;
  stageTraces: CampaignStageTrace[];
}): CampaignResult {
  const startedAt = Date.now();
  const stageWarnings = stageTraces.flatMap((trace) => [
    ...trace.warnings,
    ...(trace.fallbackReason ? [trace.fallbackReason] : [])
  ]);
  const campaignWithoutPipeline: CampaignResult = {
    mode: "openai_staged",
    generatedAt,
    advertiserAnalysis: strategy.advertiserAnalysis,
    recommendedPublishers: strategy.recommendedPublishers,
    excludedPublishers: strategy.excludedPublishers,
    selectedPersonas: strategy.selectedPersonas,
    creativeVariants: execution.creativeVariants,
    campaignConfig: execution.campaignConfig,
    warnings: unique([...strategy.warnings, ...execution.warnings, ...stageWarnings])
  };
  const validationErrors = validateCampaignResult(campaignWithoutPipeline);
  const assembleTrace: CampaignStageTrace = {
    name: "assemble",
    source: "deterministic",
    durationMs: Date.now() - startedAt,
    apiCalls: 0,
    repaired: false,
    warnings: validationErrors
  };
  const allStageTraces = [...stageTraces, assembleTrace];

  return {
    ...campaignWithoutPipeline,
    warnings: unique([...campaignWithoutPipeline.warnings, ...validationErrors]),
    pipeline: summarizePipeline(allStageTraces)
  };
}

function summarizePipeline(stages: CampaignStageTrace[]): CampaignPipelineTrace {
  return {
    apiCallCount: stages.reduce((total, stage) => total + stage.apiCalls, 0),
    repairCount: stages.filter((stage) => stage.repaired).length,
    fallbackStages: stages.filter((stage) => stage.source === "fallback").map((stage) => stage.name),
    stages
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
