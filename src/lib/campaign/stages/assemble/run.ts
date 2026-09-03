import { validateCampaignResult } from "../../../schemas";
import type { CampaignPipelineTrace, CampaignResult, CampaignStageTrace } from "../../../types";
import { addTokenUsage, emptyTokenUsage } from "../../shared/tokenUsage";
import { uniqueWarnings } from "../../shared/warnings";
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
  const stageWarnings = stageTraces.flatMap((trace) => trace.warnings);
  const campaignWithoutPipeline: CampaignResult = {
    mode: "openai_staged",
    generatedAt,
    advertiserAnalysis: strategy.advertiserAnalysis,
    recommendedPublishers: strategy.recommendedPublishers,
    excludedPublishers: strategy.excludedPublishers,
    selectedPersonas: strategy.selectedPersonas,
    creativeVariants: execution.creativeVariants,
    campaignConfig: execution.campaignConfig,
    warnings: uniqueWarnings([...strategy.warnings, ...execution.warnings, ...stageWarnings])
  };
  const validationErrors = validateCampaignResult(campaignWithoutPipeline);
  const assembleTrace: CampaignStageTrace = {
    name: "assemble",
    source: "deterministic",
    model: "code",
    durationMs: Date.now() - startedAt,
    apiCalls: 0,
    attempts: 0,
    tokenUsage: emptyTokenUsage(),
    repaired: false,
    warnings: validationErrors
  };
  const allStageTraces = [...stageTraces, assembleTrace];

  return {
    ...campaignWithoutPipeline,
    warnings: uniqueWarnings([...campaignWithoutPipeline.warnings, ...validationErrors]),
    pipeline: summarizePipeline(allStageTraces)
  };
}

function summarizePipeline(stages: CampaignStageTrace[]): CampaignPipelineTrace {
  return {
    apiCallCount: stages.reduce((total, stage) => total + stage.apiCalls, 0),
    attemptCount: stages.reduce((total, stage) => total + stage.attempts, 0),
    repairCount: stages.filter((stage) => stage.repaired).length,
    totalTokenUsage: addTokenUsage(...stages.map((stage) => stage.tokenUsage)),
    stages
  };
}
