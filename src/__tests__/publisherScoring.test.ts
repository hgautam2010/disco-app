import { describe, expect, it } from "vitest";
import { getPersonas, getPublishers } from "@/lib/data";
import { scorePersonas, selectPersonas } from "@/lib/personaScoring";
import { scorePublishers } from "@/lib/publisherScoring";
import { advertiserAnalysisFixture } from "./helpers/advertiserAnalysis";

describe("publisher scoring", () => {
  it("ranks pet publishers highest for premium senior dog food", () => {
    const analysis = advertiserAnalysisFixture();
    const selectedPersonas = selectPersonas(scorePersonas(analysis, getPersonas()));
    const { recommendedPublishers, excludedPublishers } = scorePublishers(
      analysis,
      selectedPersonas,
      getPublishers()
    );
    const topThree = recommendedPublishers.slice(0, 3).map((item) => item.publisher.name);
    const excluded = excludedPublishers.map((item) => item.publisher.name);

    expect(topThree).toEqual(["Pawline", "Ruffco", "Tailcrate"]);
    expect(excluded).toContain("Velvetline");
  });

  it("surfaces the strongest activewear and sustainability publishers", () => {
    const analysis = advertiserAnalysisFixture({
      originalDescription: "A sustainable activewear brand for women. Made from recycled ocean plastic.",
      category: "sustainable_apparel",
      priceTier: "premium",
      audienceHints: ["women", "sustainability-minded shoppers"],
      productSignals: ["sustainability", "value"],
      valuePropositions: ["specific sustainability benefit"],
      purchaseModel: "one-time purchase",
      likelyObjective: "new customer acquisition"
    });
    const selectedPersonas = selectPersonas(scorePersonas(analysis, getPersonas()));
    const { recommendedPublishers } = scorePublishers(analysis, selectedPersonas, getPublishers());
    const topNames = recommendedPublishers.map((item) => item.publisher.name);

    expect(topNames.slice(0, 3)).toEqual(expect.arrayContaining(["Movewell", "Cloudfoot", "Stride & Stem"]));
  });
});
