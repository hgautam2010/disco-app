import { analyzeAdvertiserDescription } from "../advertiserParser";
import { advertiserProfileJsonSchema } from "../schemas";
import type { AdvertiserAnalysis } from "../types";
import {
  advertiserProfileResponseSchema,
  type AdvertiserProfileResponse
} from "../validation/campaignSchemas";
import { getOpenAIModel, hasOpenAIKey } from "../openai/client";
import { buildExtractionPrompt } from "../openai/prompts";
import {
  generateAndValidateWithRepairResult,
  StructuredGenerationError,
  type RepairableStructuredRequest
} from "../openai/repairResponse";
import type { AdvertiserProfile, PipelineStageResult } from "./types";

export async function extractAdvertiserProfile(
  advertiserDescription: string
): Promise<PipelineStageResult<AdvertiserProfile>> {
  const startedAt = Date.now();
  const deterministicProfile = analyzeAdvertiserDescription(advertiserDescription);

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
        content: buildExtractionPrompt()
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

function normalizeAdvertiserProfile(
  advertiserDescription: string,
  deterministicProfile: AdvertiserAnalysis,
  profile: AdvertiserProfileResponse
): AdvertiserAnalysis {
  return {
    originalDescription: advertiserDescription.trim(),
    category: cleanText(profile.category, deterministicProfile.category),
    secondaryCategories: cleanArray(profile.secondaryCategories, deterministicProfile.secondaryCategories),
    priceTier: profile.priceTier,
    audienceHints: cleanArray(profile.audienceHints, deterministicProfile.audienceHints),
    productSignals: cleanArray(profile.productSignals, deterministicProfile.productSignals),
    valuePropositions: cleanArray(profile.valuePropositions, deterministicProfile.valuePropositions),
    purchaseModel: cleanText(profile.purchaseModel, deterministicProfile.purchaseModel),
    likelyObjective: cleanText(profile.likelyObjective, deterministicProfile.likelyObjective),
    ambiguityLevel: profile.ambiguityLevel,
    confidence: Math.max(0, Math.min(1, profile.confidence))
  };
}

function toProfileResponse(profile: AdvertiserAnalysis): AdvertiserProfileResponse {
  return {
    category: profile.category,
    secondaryCategories: profile.secondaryCategories,
    priceTier: profile.priceTier,
    audienceHints: profile.audienceHints,
    productSignals: profile.productSignals,
    valuePropositions: profile.valuePropositions,
    purchaseModel: profile.purchaseModel,
    likelyObjective: profile.likelyObjective,
    ambiguityLevel: profile.ambiguityLevel,
    confidence: profile.confidence
  };
}

function cleanText(value: string, fallback: string) {
  const cleanValue = value.trim();
  return cleanValue || fallback;
}

function cleanArray(values: string[], fallback: string[]) {
  const cleanValues = values.map((value) => value.trim()).filter(Boolean);
  return cleanValues.length > 0 ? Array.from(new Set(cleanValues)) : fallback;
}

function extractionWarnings(profile: AdvertiserAnalysis) {
  const warnings: string[] = [];

  if (profile.ambiguityLevel === "high") {
    warnings.push("Advertiser extraction is low-confidence because the pitch is vague.");
  }

  if (profile.category === "unknown") {
    warnings.push("Advertiser category is unknown; downstream matching should stay conservative.");
  }

  return warnings;
}
