import { describe, expect, it } from "vitest";
import { analyzeAdvertiserDescription } from "@/lib/advertiserParser";
import { getPersonas } from "@/lib/data";
import { scorePersonas, selectPersonas } from "@/lib/personaScoring";

describe("persona scoring", () => {
  it("selects pet-oriented personas for senior dog food", () => {
    const analysis = analyzeAdvertiserDescription(
      "We sell premium dog food for senior dogs, targeting owners who care about joint health and longevity."
    );
    const selected = selectPersonas(scorePersonas(analysis, getPersonas()));
    const names = selected.map((item) => item.persona.name);

    expect(names[0]).toBe("The Pet Parent");
    expect(names).toContain("The Busy Parent");
  });

  it("selects sustainability and fitness personas for recycled activewear", () => {
    const analysis = analyzeAdvertiserDescription(
      "A sustainable activewear brand for women. Made from recycled ocean plastic."
    );
    const selected = selectPersonas(scorePersonas(analysis, getPersonas()));
    const names = selected.map((item) => item.persona.name);

    expect(names).toContain("The Sustainability Buyer");
    expect(names).toContain("The Fitness Enthusiast");
  });
});
