import { z } from "zod";
import { advertiserProfileResponseSchema } from "../campaign/stages/extract-advertiser/schema";
import { publisherRankingResponseSchema } from "../campaign/stages/rank-publishers/schema";
import { personaSelectionResponseSchema } from "../campaign/stages/select-personas/schema";

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

export const executionResponseSchema = z.object({
  creativeVariants: z.array(creativeVariantSchema).min(3).max(5),
  campaignConfig: campaignConfigSchema,
  warnings: z.array(z.string())
});

export { advertiserProfileResponseSchema };
export { publisherRankingResponseSchema };
export { personaSelectionResponseSchema };
export type { AdvertiserProfileResponse } from "../campaign/stages/extract-advertiser/schema";
export type { PublisherRankingResponse } from "../campaign/stages/rank-publishers/schema";
export type { PersonaSelectionResponse } from "../campaign/stages/select-personas/schema";
export type ExecutionResponse = z.infer<typeof executionResponseSchema>;
