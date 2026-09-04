import {
  getOpenAIModelForStage,
  getOpenAIRequestConfigForStage,
  toResponsesRequestConfig,
  toTraceRequestConfig
} from "../../shared/openaiClient";
import { readStagePrompt } from "../../shared/prompts";
import { generateAndValidateWithRepairResult, type RepairableStructuredRequest } from "../../shared/structuredGeneration";
import type { AdvertiserProfile, PipelineStageResult } from "../../types";
import { extractionWarnings, normalizeAdvertiserProfile } from "./normalize";
import { advertiserProfileJsonSchema, advertiserProfileResponseSchema } from "./schema";

export async function extractAdvertiserProfile(
  advertiserDescription: string
): Promise<PipelineStageResult<AdvertiserProfile>> {
  const startedAt = Date.now();
  const promptInput = {
    advertiserDescription
  };
  const requestConfig = getOpenAIRequestConfigForStage("extract");
  const request: RepairableStructuredRequest = {
    model: getOpenAIModelForStage("extract"),
    ...toResponsesRequestConfig(requestConfig),
    input: [
      {
        role: "system",
        content: readStagePrompt("extract-advertiser")
      },
      {
        role: "user",
        content: JSON.stringify(promptInput)
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
      requestConfig: toTraceRequestConfig(requestConfig, result.serviceTier),
      promptInput,
      modelOutput: result.data,
      stageOutput: profile,
      durationMs: Date.now() - startedAt,
      apiCalls: result.apiCalls,
      attempts: result.attempts,
      tokenUsage: result.tokenUsage,
      repaired: result.repaired,
      warnings: extractionWarnings(profile)
    }
  };
}
