import { z } from "zod";

const stringArrayJsonSchema = {
  type: "array",
  items: { type: "string" }
};

const bidStrategyTypeSchema = z.enum(["balanced_cpm", "efficient_reach", "premium_focus"]);

const creativeVariantSchema = z.object({
  id: z.string().min(1),
  personaId: z.string().min(1),
  personaName: z.string().min(1),
  headline: z.string().min(1).max(80),
  body: z.string().min(1).max(220),
  rationale: z.string().min(1),
  tone: z.string().min(1)
});

const publisherBudgetAllocationSchema = z.object({
  publisherId: z.string().min(1),
  publisherName: z.string().min(1),
  budgetPercent: z.number().min(0).max(100),
  bidCpmUsd: z.number().positive(),
  rationale: z.string().min(1)
});

const campaignConfigSchema = z.object({
  objective: z.string().min(1),
  budget: z.object({
    totalUsd: z.number().positive(),
    dailyUsd: z.number().positive(),
    allocation: z.array(publisherBudgetAllocationSchema).min(3).max(5)
  }),
  targeting: z.object({
    categories: z.array(z.string()).min(1),
    audienceAttributes: z.array(z.string()).min(1),
    geos: z.array(z.string()).min(1),
    excludedAttributes: z.array(z.string())
  }),
  placements: z
    .array(
      z.object({
        publisherId: z.string().min(1),
        publisherName: z.string().min(1),
        placementType: z.string().min(1),
        priority: z.enum(["primary", "test"])
      })
    )
    .min(3)
    .max(5),
  bidStrategy: z.object({
    type: bidStrategyTypeSchema,
    rationale: z.string().min(1)
  }),
  measurement: z.object({
    primaryKpi: z.string().min(1),
    secondaryKpis: z.array(z.string()).min(1)
  })
});

const creativeVariantsJsonSchema = {
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

const campaignConfigJsonSchema = {
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
        categories: stringArrayJsonSchema,
        audienceAttributes: stringArrayJsonSchema,
        geos: stringArrayJsonSchema,
        excludedAttributes: stringArrayJsonSchema
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
        secondaryKpis: stringArrayJsonSchema
      }
    }
  }
};

export const executionResponseSchema = z.object({
  creativeVariants: z.array(creativeVariantSchema).min(3).max(5),
  campaignConfig: campaignConfigSchema,
  warnings: z.array(z.string())
});

export const executionResponseJsonSchema = {
  name: "execution_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["creativeVariants", "campaignConfig", "warnings"],
    properties: {
      creativeVariants: creativeVariantsJsonSchema,
      campaignConfig: campaignConfigJsonSchema,
      warnings: stringArrayJsonSchema
    }
  }
};

export type ExecutionResponse = z.infer<typeof executionResponseSchema>;
