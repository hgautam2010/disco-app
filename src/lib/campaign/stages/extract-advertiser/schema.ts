import { z } from "zod";
import { advertiserCategoryValues, productSignalValues } from "../../../advertiserTaxonomy";

const advertiserCategorySchema = z.enum(advertiserCategoryValues);
const priceTierSchema = z.enum(["budget", "value", "mid_market", "premium", "luxury", "unknown"]);
const ambiguityLevelSchema = z.enum(["low", "medium", "high"]);
const productSignalSchema = z.enum(productSignalValues);

export const advertiserProfileResponseSchema = z.object({
  category: advertiserCategorySchema,
  secondaryCategories: z.array(advertiserCategorySchema),
  priceTier: priceTierSchema,
  audienceHints: z.array(z.string()),
  productSignals: z.array(productSignalSchema),
  valuePropositions: z.array(z.string()),
  purchaseModel: z.string().min(1),
  likelyObjective: z.string().min(1),
  ambiguityLevel: ambiguityLevelSchema,
  confidence: z.number().min(0).max(1)
});

export const advertiserProfileJsonSchema = {
  name: "advertiser_profile",
  strict: true,
  schema: {
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
      category: { type: "string", enum: advertiserCategoryValues },
      secondaryCategories: { type: "array", items: { type: "string", enum: advertiserCategoryValues } },
      priceTier: {
        type: "string",
        enum: ["budget", "value", "mid_market", "premium", "luxury", "unknown"]
      },
      audienceHints: { type: "array", items: { type: "string" } },
      productSignals: { type: "array", items: { type: "string", enum: productSignalValues } },
      valuePropositions: { type: "array", items: { type: "string" } },
      purchaseModel: { type: "string" },
      likelyObjective: { type: "string" },
      ambiguityLevel: { type: "string", enum: ["low", "medium", "high"] },
      confidence: { type: "number", minimum: 0, maximum: 1 }
    }
  }
};

export type AdvertiserProfileResponse = z.infer<typeof advertiserProfileResponseSchema>;
