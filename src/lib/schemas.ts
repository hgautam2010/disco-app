import type { CampaignResult, CreativeVariant } from "./types";

type JsonSchema = Record<string, unknown>;

const stringArraySchema: JsonSchema = {
  type: "array",
  items: { type: "string" }
};

const scoreSignalSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "detail", "weight"],
  properties: {
    label: { type: "string" },
    detail: { type: "string" },
    weight: { type: "number" }
  }
};

const advertiserAnalysisSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "category",
    "secondaryCategories",
    "priceTier",
    "audienceHints",
    "productSignals",
    "valuePropositions",
    "purchaseModel",
    "likelyObjective",
    "ambiguityLevel",
    "confidence"
  ],
  properties: {
    category: { type: "string" },
    secondaryCategories: stringArraySchema,
    priceTier: {
      type: "string",
      enum: ["budget", "value", "mid_market", "premium", "luxury", "unknown"]
    },
    audienceHints: stringArraySchema,
    productSignals: stringArraySchema,
    valuePropositions: stringArraySchema,
    purchaseModel: { type: "string" },
    likelyObjective: { type: "string" },
    ambiguityLevel: { type: "string", enum: ["low", "medium", "high"] },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  }
};

const creativeVariantsSchema: JsonSchema = {
  type: "array",
  minItems: 3,
  maxItems: 5,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["id", "personaId", "personaName", "headline", "body", "rationale", "tone"],
    properties: {
      id: { type: "string" },
      personaId: { type: "string" },
      personaName: { type: "string" },
      headline: { type: "string" },
      body: { type: "string" },
      rationale: { type: "string" },
      tone: { type: "string" }
    }
  }
};

const campaignConfigSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["objective", "budget", "targeting", "placements", "bidStrategy", "measurement"],
  properties: {
    objective: { type: "string" },
    budget: {
      type: "object",
      additionalProperties: false,
      required: ["totalUsd", "dailyUsd", "allocation"],
      properties: {
        totalUsd: { type: "number" },
        dailyUsd: { type: "number" },
        allocation: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["publisherId", "publisherName", "budgetPercent", "bidCpmUsd", "rationale"],
            properties: {
              publisherId: { type: "string" },
              publisherName: { type: "string" },
              budgetPercent: { type: "number" },
              bidCpmUsd: { type: "number" },
              rationale: { type: "string" }
            }
          }
        }
      }
    },
    targeting: {
      type: "object",
      additionalProperties: false,
      required: ["categories", "audienceAttributes", "geos", "excludedAttributes"],
      properties: {
        categories: stringArraySchema,
        audienceAttributes: stringArraySchema,
        geos: stringArraySchema,
        excludedAttributes: stringArraySchema
      }
    },
    placements: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["publisherId", "publisherName", "placementType", "priority"],
        properties: {
          publisherId: { type: "string" },
          publisherName: { type: "string" },
          placementType: { type: "string" },
          priority: { type: "string", enum: ["primary", "test"] }
        }
      }
    },
    bidStrategy: {
      type: "object",
      additionalProperties: false,
      required: ["type", "rationale"],
      properties: {
        type: {
          type: "string",
          enum: ["balanced_cpm", "efficient_reach", "premium_focus"]
        },
        rationale: { type: "string" }
      }
    },
    measurement: {
      type: "object",
      additionalProperties: false,
      required: ["primaryKpi", "secondaryKpis"],
      properties: {
        primaryKpi: { type: "string" },
        secondaryKpis: stringArraySchema
      }
    }
  }
};

export const campaignResultJsonSchema: JsonSchema = {
  name: "campaign_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "advertiserAnalysis",
      "publisherNarratives",
      "excludedPublisherNarratives",
      "personaNarratives",
      "creativeVariants",
      "campaignConfig",
      "warnings"
    ],
    properties: {
      advertiserAnalysis: advertiserAnalysisSchema,
      publisherNarratives: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["publisherId", "rationale", "risk", "budgetRationale"],
          properties: {
            publisherId: { type: "string" },
            rationale: { type: "string" },
            risk: { type: "string" },
            budgetRationale: { type: "string" }
          }
        }
      },
      excludedPublisherNarratives: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["publisherId", "reason"],
          properties: {
            publisherId: { type: "string" },
            reason: { type: "string" }
          }
        }
      },
      personaNarratives: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["personaId", "rationale", "messagingAngles"],
          properties: {
            personaId: { type: "string" },
            rationale: { type: "string" },
            messagingAngles: stringArraySchema
          }
        }
      },
      creativeVariants: creativeVariantsSchema,
      campaignConfig: {
        type: "object",
        additionalProperties: false,
        required: ["objective", "targeting", "bidStrategy", "measurement"],
        properties: {
          objective: { type: "string" },
          targeting: {
            type: "object",
            additionalProperties: false,
            required: ["categories", "audienceAttributes", "geos", "excludedAttributes"],
            properties: {
              categories: stringArraySchema,
              audienceAttributes: stringArraySchema,
              geos: stringArraySchema,
              excludedAttributes: stringArraySchema
            }
          },
          bidStrategy: {
            type: "object",
            additionalProperties: false,
            required: ["type", "rationale"],
            properties: {
              type: {
                type: "string",
                enum: ["balanced_cpm", "efficient_reach", "premium_focus"]
              },
              rationale: { type: "string" }
            }
          },
          measurement: {
            type: "object",
            additionalProperties: false,
            required: ["primaryKpi", "secondaryKpis"],
            properties: {
              primaryKpi: { type: "string" },
              secondaryKpis: stringArraySchema
            }
          }
        }
      },
      warnings: stringArraySchema
    }
  }
};

export const inlineCampaignResultJsonSchema: JsonSchema = {
  name: "inline_campaign_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "advertiserAnalysis",
      "recommendedPublishers",
      "excludedPublishers",
      "selectedPersonas",
      "creativeVariants",
      "campaignConfig",
      "warnings"
    ],
    properties: {
      advertiserAnalysis: advertiserAnalysisSchema,
      recommendedPublishers: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["publisherId", "score", "reasons", "risks", "signals"],
          properties: {
            publisherId: { type: "string" },
            score: { type: "number", minimum: 0, maximum: 100 },
            reasons: stringArraySchema,
            risks: stringArraySchema,
            signals: {
              type: "array",
              items: scoreSignalSchema
            }
          }
        }
      },
      excludedPublishers: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["publisherId", "score", "reason", "signals"],
          properties: {
            publisherId: { type: "string" },
            score: { type: "number", minimum: 0, maximum: 100 },
            reason: { type: "string" },
            signals: {
              type: "array",
              items: scoreSignalSchema
            }
          }
        }
      },
      selectedPersonas: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["personaId", "score", "reasons", "risks", "messagingAngles", "signals"],
          properties: {
            personaId: { type: "string" },
            score: { type: "number", minimum: 0, maximum: 100 },
            reasons: stringArraySchema,
            risks: stringArraySchema,
            messagingAngles: stringArraySchema,
            signals: {
              type: "array",
              items: scoreSignalSchema
            }
          }
        }
      },
      creativeVariants: creativeVariantsSchema,
      campaignConfig: campaignConfigSchema,
      warnings: stringArraySchema
    }
  }
};

export function validateCreativeVariants(variants: CreativeVariant[]) {
  const errors: string[] = [];

  if (variants.length < 3 || variants.length > 5) {
    errors.push("Creative output must include 3 to 5 variants.");
  }

  variants.forEach((variant, index) => {
    if (!variant.personaId) {
      errors.push(`Creative ${index + 1} is missing a persona id.`);
    }

    if (!variant.headline || variant.headline.length > 80) {
      errors.push(`Creative ${index + 1} must have a headline under 80 characters.`);
    }

    if (!variant.body || variant.body.length > 220) {
      errors.push(`Creative ${index + 1} must have body copy under 220 characters.`);
    }
  });

  return errors;
}

export function validateCampaignResult(result: CampaignResult) {
  const errors: string[] = [];
  const recommendedPublisherIds = new Set(result.recommendedPublishers.map((item) => item.publisher.id));
  const selectedPersonaIds = new Set(result.selectedPersonas.map((item) => item.persona.id));
  const allocationTotal = result.campaignConfig.budget.allocation.reduce(
    (total, item) => total + item.budgetPercent,
    0
  );

  result.excludedPublishers.forEach((item) => {
    if (recommendedPublisherIds.has(item.publisher.id)) {
      errors.push(`${item.publisher.name} cannot be both recommended and excluded.`);
    }
  });

  result.creativeVariants.forEach((variant) => {
    if (!selectedPersonaIds.has(variant.personaId)) {
      errors.push(`${variant.headline} references an unselected persona.`);
    }
  });

  if (Math.abs(allocationTotal - 100) > 0.01) {
    errors.push(`Budget allocation must sum to 100, received ${allocationTotal}.`);
  }

  return [...errors, ...validateCreativeVariants(result.creativeVariants)];
}
