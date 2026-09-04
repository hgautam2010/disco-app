import { getPersonas, getPublishers } from "../../../data";
import type { Persona, Publisher } from "../../../types";
import { emptyTokenUsage } from "../../shared/tokenUsage";
import type { AdvertiserProfile, CampaignCatalogue, PipelineStageResult } from "../../types";

export function loadCampaignCatalogue(
  advertiserProfile: AdvertiserProfile,
  options: {
    publishers?: Publisher[];
    personas?: Persona[];
  } = {}
): PipelineStageResult<CampaignCatalogue> {
  const startedAt = Date.now();
  const publishers = options.publishers ?? getPublishers();
  const personas = options.personas ?? getPersonas();
  const warnings = catalogueWarnings(advertiserProfile, publishers, personas);
  const data = {
    advertiserProfile,
    publishers,
    personas,
    warnings
  };

  return {
    data,
    trace: {
      name: "retrieve",
      source: "deterministic",
      model: "code",
      promptInput: {
        advertiserProfile
      },
      modelOutput: null,
      stageOutput: {
        advertiserProfile,
        publisherCount: publishers.length,
        personaCount: personas.length,
        publishers,
        personas,
        warnings
      },
      durationMs: Date.now() - startedAt,
      apiCalls: 0,
      attempts: 0,
      tokenUsage: emptyTokenUsage(),
      repaired: false,
      warnings
    }
  };
}

function catalogueWarnings(advertiserProfile: AdvertiserProfile, publishers: Publisher[], personas: Persona[]) {
  const warnings: string[] = [];

  if (advertiserProfile.category === "b2b_saas") {
    warnings.push("Publisher catalog is consumer-commerce oriented; B2B recommendations are directional.");
  }

  if (publishers.length < 3) {
    warnings.push("Publisher catalogue has fewer than three entries; recommendations may be incomplete.");
  }

  if (personas.length < 3) {
    warnings.push("Persona catalogue has fewer than three entries; creative coverage may be incomplete.");
  }

  return warnings;
}
