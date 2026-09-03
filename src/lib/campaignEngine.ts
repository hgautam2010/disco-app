import { generateStagedOpenAICampaign } from "./campaign/pipeline";
import { hasOpenAIKey } from "./campaign/shared/openaiClient";
import type { CampaignResult } from "./types";

export async function generateCampaign(advertiserDescription: string): Promise<CampaignResult> {
  if (!hasOpenAIKey()) {
    throw new Error("OPENAI_API_KEY is required to generate a campaign.");
  }

  return generateStagedOpenAICampaign(advertiserDescription);
}
