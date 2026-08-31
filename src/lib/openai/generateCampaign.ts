import { campaignResultJsonSchema, validateCreativeVariants } from "../schemas";
import type {
  AdvertiserAnalysis,
  CampaignConfig,
  CampaignResult,
  CreativeVariant,
  ScoredPersona,
  ScoredPublisher
} from "../types";
import { createStructuredResponse, getOpenAIModel } from "./client";
import { buildCampaignSystemPrompt } from "./prompts";

type OpenAIDraft = {
  advertiserAnalysis: Omit<AdvertiserAnalysis, "originalDescription">;
  publisherNarratives: {
    publisherId: string;
    rationale: string;
    risk: string;
    budgetRationale: string;
  }[];
  excludedPublisherNarratives: {
    publisherId: string;
    reason: string;
  }[];
  personaNarratives: {
    personaId: string;
    rationale: string;
    messagingAngles: string[];
  }[];
  creativeVariants: CreativeVariant[];
  campaignConfig: Pick<CampaignConfig, "objective" | "targeting" | "bidStrategy" | "measurement">;
  warnings: string[];
};

export async function generateOpenAICampaign(baseline: CampaignResult): Promise<CampaignResult> {
  const draft = await createStructuredResponse<OpenAIDraft>({
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: buildCampaignSystemPrompt()
      },
      {
        role: "user",
        content: JSON.stringify(buildOpenAIBrief(baseline))
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...campaignResultJsonSchema
      }
    }
  });

  return mergeDraftWithBaseline(baseline, draft);
}

function buildOpenAIBrief(baseline: CampaignResult) {
  return {
    advertiserDescription: baseline.advertiserAnalysis.originalDescription,
    deterministicAdvertiserAnalysis: baseline.advertiserAnalysis,
    recommendedPublisherCandidates: baseline.recommendedPublishers.map((item) => ({
      publisherId: item.publisher.id,
      name: item.publisher.name,
      score: item.score,
      category: item.publisher.category,
      subcategories: item.publisher.subcategories,
      monthlyImpressions: item.publisher.monthly_impressions,
      averageOrderValueUsd: item.publisher.avg_order_value_usd,
      audience: item.publisher.audience,
      notes: item.publisher.notes,
      deterministicReasons: item.reasons,
      deterministicRisks: item.risks
    })),
    excludedPublisherCandidates: baseline.excludedPublishers.map((item) => ({
      publisherId: item.publisher.id,
      name: item.publisher.name,
      score: item.score,
      reason: item.reason,
      category: item.publisher.category,
      subcategories: item.publisher.subcategories,
      notes: item.publisher.notes
    })),
    selectedPersonas: baseline.selectedPersonas.map((item) => ({
      personaId: item.persona.id,
      name: item.persona.name,
      score: item.score,
      ageRange: item.persona.age_range,
      genderSkew: item.persona.gender_skew,
      description: item.persona.description,
      categoryAffinities: item.persona.category_affinities,
      messagingPreferences: item.persona.messaging_preferences,
      disinterestedIn: item.persona.disinterested_in,
      deterministicReasons: item.reasons,
      deterministicRisks: item.risks
    })),
    deterministicCampaignConfig: baseline.campaignConfig
  };
}

function mergeDraftWithBaseline(baseline: CampaignResult, draft: OpenAIDraft): CampaignResult {
  const creativeErrors = validateCreativeVariants(draft.creativeVariants);

  if (creativeErrors.length > 0) {
    throw new Error(`OpenAI creative validation failed: ${creativeErrors.join(" ")}`);
  }

  return {
    ...baseline,
    mode: "openai",
    advertiserAnalysis: {
      ...baseline.advertiserAnalysis,
      ...draft.advertiserAnalysis,
      originalDescription: baseline.advertiserAnalysis.originalDescription
    },
    recommendedPublishers: mergePublisherNarratives(baseline.recommendedPublishers, draft.publisherNarratives),
    excludedPublishers: baseline.excludedPublishers.map((item) => {
      const narrative = draft.excludedPublisherNarratives.find(
        (candidate) => candidate.publisherId === item.publisher.id
      );

      return narrative ? { ...item, reason: narrative.reason } : item;
    }),
    selectedPersonas: mergePersonaNarratives(baseline.selectedPersonas, draft.personaNarratives),
    creativeVariants: alignCreativePersonas(draft.creativeVariants, baseline.selectedPersonas),
    campaignConfig: {
      ...baseline.campaignConfig,
      objective: draft.campaignConfig.objective || baseline.campaignConfig.objective,
      targeting: draft.campaignConfig.targeting,
      bidStrategy: draft.campaignConfig.bidStrategy,
      measurement: draft.campaignConfig.measurement
    },
    warnings: Array.from(new Set([...baseline.warnings, ...draft.warnings]))
  };
}

function mergePublisherNarratives(
  publishers: ScoredPublisher[],
  narratives: OpenAIDraft["publisherNarratives"]
) {
  return publishers.map((item) => {
    const narrative = narratives.find((candidate) => candidate.publisherId === item.publisher.id);

    if (!narrative) {
      return item;
    }

    return {
      ...item,
      reasons: [narrative.rationale, narrative.budgetRationale].filter(Boolean),
      risks: narrative.risk ? [narrative.risk] : item.risks
    };
  });
}

function mergePersonaNarratives(personas: ScoredPersona[], narratives: OpenAIDraft["personaNarratives"]) {
  return personas.map((item) => {
    const narrative = narratives.find((candidate) => candidate.personaId === item.persona.id);

    if (!narrative) {
      return item;
    }

    return {
      ...item,
      reasons: [narrative.rationale],
      messagingAngles: narrative.messagingAngles
    };
  });
}

function alignCreativePersonas(variants: CreativeVariant[], personas: ScoredPersona[]) {
  const personaById = new Map(personas.map((item) => [item.persona.id, item.persona]));

  return variants.map((variant, index) => {
    const persona = personaById.get(variant.personaId) ?? personas[index % personas.length]?.persona;

    if (!persona) {
      return variant;
    }

    return {
      ...variant,
      id: variant.id || `creative_${String(index + 1).padStart(2, "0")}`,
      personaId: persona.id,
      personaName: persona.name
    };
  });
}
