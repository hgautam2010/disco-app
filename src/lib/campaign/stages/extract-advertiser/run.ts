import { getOpenAIModelForStage } from "../../shared/openaiClient";
import { readStagePrompt } from "../../shared/prompts";
import { generateAndValidateWithRepairResult, type RepairableStructuredRequest } from "../../shared/structuredGeneration";
import type { AdvertiserProfile, PipelineStageResult } from "../../types";
import { extractionWarnings, normalizeAdvertiserProfile } from "./normalize";
import { advertiserProfileJsonSchema, advertiserProfileResponseSchema } from "./schema";

export async function extractAdvertiserProfile(
  advertiserDescription: string
): Promise<PipelineStageResult<AdvertiserProfile>> {
  const startedAt = Date.now();
  const input = {
    advertiserDescription
  };
  const request: RepairableStructuredRequest = {
    model: getOpenAIModelForStage("extract"),
    input: [
      {
        role: "system",
        content: readStagePrompt("extract-advertiser")
      },
      {
        role: "user",
        content: JSON.stringify(input)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...advertiserProfileJsonSchema
      }
    }
  };

  const result = await generateAndValidateWithRepairResult({
    label: "advertiser_profile",
    schema: advertiserProfileResponseSchema,
    request,
    repairContext: {
      advertiserDescription
    }
  });
  const profile = normalizeAdvertiserProfile(advertiserDescription, result.data);

  return {
    data: profile,
    trace: {
      name: "extract",
      source: "openai",
      model: result.model,
      input,
      output: profile,
      durationMs: Date.now() - startedAt,
      apiCalls: result.apiCalls,
      attempts: result.attempts,
      tokenUsage: result.tokenUsage,
      repaired: result.repaired,
      warnings: extractionWarnings(profile)
    }
  };
}
