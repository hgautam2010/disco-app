import { describe, expect, it } from "vitest";
import { generateCampaign } from "@/lib/campaignEngine";

describe("campaign engine", () => {
  it("requires an OpenAI API key for generated campaigns", async () => {
    await withoutOpenAIKey(async () => {
      await expect(generateCampaign("Premium dog food for senior dogs.")).rejects.toThrow(
        "OPENAI_API_KEY is required"
      );
    });
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
