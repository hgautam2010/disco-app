import { describe, expect, it } from "vitest";
import { getPersonas } from "@/lib/data";
import { scorePersonas, selectPersonas } from "@/lib/personaScoring";
import { advertiserAnalysisFixture } from "./helpers/advertiserAnalysis";

describe("persona scoring", () => {
  it("selects pet-oriented personas for senior dog food", () => {
    const analysis = advertiserAnalysisFixture();
    const selected = selectPersonas(scorePersonas(analysis, getPersonas()));
    const names = selected.map((item) => item.persona.name);

    expect(names[0]).toBe("The Pet Parent");
    expect(names).toContain("The Busy Parent");
  });

  it("selects sustainability and fitness personas for recycled activewear", () => {
    const analysis = advertiserAnalysisFixture({
      originalDescription: "A sustainable activewear brand for women. Made from recycled ocean plastic.",
      category: "sustainable_apparel",
      priceTier: "premium",
      audienceHints: ["women", "sustainability-minded shoppers"],
      productSignals: ["sustainability", "value"],
      valuePropositions: ["specific sustainability benefit"]
    });
    const selected = selectPersonas(scorePersonas(analysis, getPersonas()));
    const names = selected.map((item) => item.persona.name);

    expect(names).toContain("The Sustainability Buyer");
    expect(names).toContain("The Fitness Enthusiast");
  });
});
