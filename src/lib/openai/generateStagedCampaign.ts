import { getPersonas, getPublishers } from "../data";
import type { CampaignResult } from "../types";
import { generateExecution } from "./generateExecution";
import { generateStrategy } from "./generateStrategy";
import { normalizeExecution } from "./normalizeExecution";
import { normalizeStrategy } from "./normalizeStrategy";

export async function generateStagedOpenAICampaign(
  advertiserDescription: string,
  baseline: CampaignResult
): Promise<CampaignResult> {
  const strategyDraft = await generateStrategy(advertiserDescription);
  const strategy = normalizeStrategy({
    advertiserDescription,
    baseline,
    strategy: strategyDraft,
    publishers: getPublishers(),
    personas: getPersonas()
  });
  const executionDraft = await generateExecution(advertiserDescription, strategy);

  return normalizeExecution({
    baseline,
    strategy,
    execution: executionDraft
  });
}
