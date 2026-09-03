import { getOpenAIModel } from "../../shared/openaiClient";
import { readStagePrompt } from "../../shared/prompts";
import { generateAndValidateWithRepairResult, type RepairableStructuredRequest } from "../../shared/structuredGeneration";
import type { AdvertiserProfile, PipelineStageResult } from "../../types";
import { extractionWarnings, normalizeAdvertiserProfile } from "./normalize";
import { advertiserProfileJsonSchema, advertiserProfileResponseSchema } from "./schema";

export async function extractAdvertiserProfile(
  advertiserDescription: string
): Promise<PipelineStageResult<AdvertiserProfile>> {
  const startedAt = Date.now();
  const request: RepairableStructuredRequest = {
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: readStagePrompt("extract-advertiser")
      },
      {
        role: "user",
        content: JSON.stringify({
          advertiserDescription
        })
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
      durationMs: Date.now() - startedAt,
      apiCalls: result.apiCalls,
      attempts: result.attempts,
      tokenUsage: result.tokenUsage,
      repaired: result.repaired,
      warnings: extractionWarnings(profile)
    }
  };
}
