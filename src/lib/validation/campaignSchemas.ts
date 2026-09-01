import { z } from "zod";
import { advertiserProfileResponseSchema } from "../campaign/stages/extract-advertiser/schema";
import { publisherRankingResponseSchema } from "../campaign/stages/rank-publishers/schema";

const bidStrategyTypeSchema = z.enum(["balanced_cpm", "efficient_reach", "premium_focus"]);

const scoreSignalSchema = z.object({
  label: z.string().min(1),
  detail: z.string().min(1),
  weight: z.number()
});

const strategyPersonaSchema = z.object({
  personaId: z.string().min(1),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string().min(1)).min(1),
  risks: z.array(z.string()),
  messagingAngles: z.array(z.string()),
  signals: z.array(scoreSignalSchema)
});

export const personaSelectionResponseSchema = z.object({
  selectedPersonas: z.array(strategyPersonaSchema).min(3).max(5),
  warnings: z.array(z.string())
});

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

export const executionResponseSchema = z.object({
  creativeVariants: z.array(creativeVariantSchema).min(3).max(5),
  campaignConfig: campaignConfigSchema,
  warnings: z.array(z.string())
});

export { advertiserProfileResponseSchema };
export { publisherRankingResponseSchema };
export type { AdvertiserProfileResponse } from "../campaign/stages/extract-advertiser/schema";
export type { PublisherRankingResponse } from "../campaign/stages/rank-publishers/schema";
export type PersonaSelectionResponse = z.infer<typeof personaSelectionResponseSchema>;
export type ExecutionResponse = z.infer<typeof executionResponseSchema>;
