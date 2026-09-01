import { z } from "zod";

const stringArrayJsonSchema = {
  type: "array",
  items: { type: "string" }
};

const scoreSignalSchema = z.object({
  label: z.string().min(1),
  detail: z.string().min(1),
  weight: z.number()
});

const scoreSignalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "detail", "weight"],
  properties: {
    label: { type: "string" },
    detail: { type: "string" },
    weight: { type: "number" }
  }
};

const strategyPublisherSchema = z.object({
  publisherId: z.string().min(1),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string().min(1)).min(1),
  risks: z.array(z.string()),
  signals: z.array(scoreSignalSchema)
});

const excludedPublisherSchema = z.object({
  publisherId: z.string().min(1),
  score: z.number().min(0).max(100),
  reason: z.string().min(1),
  signals: z.array(scoreSignalSchema)
});

const recommendedPublishersJsonSchema = {
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
      reasons: stringArrayJsonSchema,
      risks: stringArrayJsonSchema,
      signals: {
        type: "array",
        items: scoreSignalJsonSchema
      }
    }
  }
};

const excludedPublishersJsonSchema = {
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
        items: scoreSignalJsonSchema
      }
    }
  }
};

export const publisherRankingResponseSchema = z.object({
  recommendedPublishers: z.array(strategyPublisherSchema).min(3).max(5),
  excludedPublishers: z.array(excludedPublisherSchema).min(3).max(8),
  warnings: z.array(z.string())
});

export const publisherRankingResponseJsonSchema = {
  name: "publisher_ranking_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["recommendedPublishers", "excludedPublishers", "warnings"],
    properties: {
      recommendedPublishers: recommendedPublishersJsonSchema,
      excludedPublishers: excludedPublishersJsonSchema,
      warnings: stringArrayJsonSchema
    }
  }
};

export type PublisherRankingResponse = z.infer<typeof publisherRankingResponseSchema>;
