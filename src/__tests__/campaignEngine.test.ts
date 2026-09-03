import { describe, expect, it } from "vitest";
import { generateCampaign, generateDeterministicCampaign } from "@/lib/campaignEngine";
import { validateCampaignResult } from "@/lib/schemas";

describe("campaign engine", () => {
  it("requires an OpenAI API key for generated campaigns", async () => {
    await withoutOpenAIKey(async () => {
      await expect(generateCampaign("Premium dog food for senior dogs.")).rejects.toThrow(
        "OPENAI_API_KEY is required"
      );
    });
  });

  it("returns a complete valid campaign result", () => {
    const result = generateDeterministicCampaign(
      "Refillable, concentrated cleaning products. Skip the single-use plastic bottles."
    );
    const allocationTotal = result.campaignConfig.budget.allocation.reduce(
      (total, item) => total + item.budgetPercent,
      0
    );

    expect(result.recommendedPublishers.length).toBeGreaterThanOrEqual(3);
    expect(result.selectedPersonas.length).toBeGreaterThanOrEqual(3);
    expect(result.creativeVariants.length).toBeGreaterThanOrEqual(3);
    expect(allocationTotal).toBe(100);
    expect(validateCampaignResult(result)).toEqual([]);
  });

  it("flags low-signal advertiser descriptions", () => {
    const result = generateDeterministicCampaign("idk just try it");

    expect(result.advertiserAnalysis.ambiguityLevel).toBe("high");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

async function withoutOpenAIKey<T>(callback: () => Promise<T>) {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    return await callback();
  } finally {
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
}
