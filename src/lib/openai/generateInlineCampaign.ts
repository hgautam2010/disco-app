import { getPersonas, getPublishers } from "../data";
import { inlineCampaignResultJsonSchema } from "../schemas";
import type {
  AdvertiserAnalysis,
  CampaignConfig,
  CampaignResult,
  CreativeVariant,
  ExcludedPublisher,
  Persona,
  Publisher,
  ScoredPersona,
  ScoredPublisher,
  ScoreSignal
} from "../types";
import { createStructuredResponse, getOpenAIModel } from "./client";
import { buildFullInlineCampaignPrompt } from "./prompts";

export type InlineCampaignDraft = {
  advertiserAnalysis: Omit<AdvertiserAnalysis, "originalDescription">;
  recommendedPublishers: {
    publisherId: string;
    score: number;
    reasons: string[];
    risks: string[];
    signals: ScoreSignal[];
  }[];
  excludedPublishers: {
    publisherId: string;
    score: number;
    reason: string;
    signals: ScoreSignal[];
  }[];
  selectedPersonas: {
    personaId: string;
    score: number;
    reasons: string[];
    risks: string[];
    messagingAngles: string[];
    signals: ScoreSignal[];
  }[];
  creativeVariants: CreativeVariant[];
  campaignConfig: CampaignConfig;
  warnings: string[];
};

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

  return inlineDraftToCampaignResult(advertiserDescription, baseline, draft, publishers, personas);
}

function inlineDraftToCampaignResult(
  advertiserDescription: string,
  baseline: CampaignResult,
  draft: InlineCampaignDraft,
  publishers: Publisher[],
  personas: Persona[]
): CampaignResult {
  const publisherById = new Map(publishers.map((publisher) => [publisher.id, publisher]));
  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const recommendedPublishers = draft.recommendedPublishers.map((item) => {
    const publisher = publisherById.get(item.publisherId);

    if (!publisher) {
      throw new Error(`OpenAI returned unknown recommended publisher id: ${item.publisherId}`);
    }

    return {
      publisher,
      score: Math.round(item.score),
      normalizedScore: item.score / 100,
      reasons: item.reasons,
      risks: item.risks,
      signals: item.signals
    } satisfies ScoredPublisher;
  });
  const excludedPublishers = draft.excludedPublishers.map((item) => {
    const publisher = publisherById.get(item.publisherId);

    if (!publisher) {
      throw new Error(`OpenAI returned unknown excluded publisher id: ${item.publisherId}`);
    }

    return {
      publisher,
      score: Math.round(item.score),
      reason: item.reason,
      signals: item.signals
    } satisfies ExcludedPublisher;
  });
  const selectedPersonas = draft.selectedPersonas.map((item) => {
    const persona = personaById.get(item.personaId);

    if (!persona) {
      throw new Error(`OpenAI returned unknown persona id: ${item.personaId}`);
    }

    return {
      persona,
      score: Math.round(item.score),
      normalizedScore: item.score / 100,
      reasons: item.reasons,
      risks: item.risks,
      messagingAngles: item.messagingAngles,
      signals: item.signals
    } satisfies ScoredPersona;
  });

  return {
    mode: "openai_inline",
    generatedAt: baseline.generatedAt,
    advertiserAnalysis: {
      ...draft.advertiserAnalysis,
      originalDescription: advertiserDescription
    },
    recommendedPublishers,
    excludedPublishers,
    selectedPersonas,
    creativeVariants: draft.creativeVariants,
    campaignConfig: draft.campaignConfig,
    warnings: draft.warnings
  };
}
