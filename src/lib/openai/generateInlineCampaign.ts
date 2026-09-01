import { getPersonas, getPublishers } from "../data";
import { inlineCampaignResultJsonSchema } from "../schemas";
import type { CampaignResult } from "../types";
import { createStructuredResponse, getOpenAIModel } from "./client";
import { normalizeInlineCampaignDraft, type InlineCampaignDraft } from "./normalizeCampaign";
import { buildFullInlineCampaignPrompt } from "./prompts";

export async function generateInlineOpenAICampaign(
  advertiserDescription: string,
  baseline: CampaignResult
): Promise<CampaignResult> {
  const publishers = getPublishers();
  const personas = getPersonas();
  const draft = await createStructuredResponse<InlineCampaignDraft>({
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: buildFullInlineCampaignPrompt()
      },
      {
        role: "user",
        content: JSON.stringify({
          advertiserDescription,
          publishers,
          personas
        })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...inlineCampaignResultJsonSchema
      }
    }
  });

  return normalizeInlineCampaignDraft(advertiserDescription, baseline, draft, publishers, personas);
}
