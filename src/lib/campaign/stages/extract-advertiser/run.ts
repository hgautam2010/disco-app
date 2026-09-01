import { getOpenAIModel, hasOpenAIKey } from "../../shared/openaiClient";
import { readStagePrompt } from "../../shared/prompts";
import {
  generateAndValidateWithRepairResult,
  StructuredGenerationError,
  type RepairableStructuredRequest
} from "../../shared/structuredGeneration";
import type { AdvertiserProfile, PipelineStageResult } from "../../types";
import {
  buildDeterministicAdvertiserProfile,
  extractionWarnings,
  normalizeAdvertiserProfile,
  toProfileResponse
} from "./fallback";
import { advertiserProfileJsonSchema, advertiserProfileResponseSchema } from "./schema";

export async function extractAdvertiserProfile(
  advertiserDescription: string
): Promise<PipelineStageResult<AdvertiserProfile>> {
  const startedAt = Date.now();
  const deterministicProfile = buildDeterministicAdvertiserProfile(advertiserDescription);

  if (!hasOpenAIKey()) {
    return {
      data: deterministicProfile,
      trace: {
        name: "extract",
        source: "deterministic",
        durationMs: Date.now() - startedAt,
        apiCalls: 0,
        repaired: false,
        warnings: extractionWarnings(deterministicProfile)
      }
    };
  }

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

  try {
    const result = await generateAndValidateWithRepairResult({
      label: "advertiser_profile",
      schema: advertiserProfileResponseSchema,
      request,
      fallbackCandidates: {
        deterministicProfile: toProfileResponse(deterministicProfile)
      }
    });
    const profile = normalizeAdvertiserProfile(advertiserDescription, deterministicProfile, result.data);

    return {
      data: profile,
      trace: {
        name: "extract",
        source: "openai",
        durationMs: Date.now() - startedAt,
        apiCalls: result.apiCalls,
        repaired: result.repaired,
        warnings: extractionWarnings(profile)
      }
    };
  } catch (error) {
    const structuredError = error instanceof StructuredGenerationError ? error : null;
    const message = error instanceof Error ? error.message : "OpenAI extraction failed.";

    return {
      data: deterministicProfile,
      trace: {
        name: "extract",
        source: "fallback",
        durationMs: Date.now() - startedAt,
        apiCalls: structuredError?.apiCalls ?? 1,
        repaired: structuredError?.repaired ?? false,
        warnings: extractionWarnings(deterministicProfile),
        fallbackReason: `OpenAI extraction failed; using deterministic extraction. ${message}`
      }
    };
  }
}
