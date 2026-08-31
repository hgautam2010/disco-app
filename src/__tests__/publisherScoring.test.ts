import { describe, expect, it } from "vitest";
import { analyzeAdvertiserDescription } from "@/lib/advertiserParser";
import { getPersonas, getPublishers } from "@/lib/data";
import { scorePersonas, selectPersonas } from "@/lib/personaScoring";
import { scorePublishers } from "@/lib/publisherScoring";

describe("publisher scoring", () => {
  it("ranks pet publishers highest for premium senior dog food", () => {
    const analysis = analyzeAdvertiserDescription(
      "We sell premium dog food for senior dogs, targeting owners who care about joint health and longevity. Grain-free, vet-formulated, subscription-based."
    );
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
    const analysis = analyzeAdvertiserDescription(
      "A sustainable activewear brand for women. Made from recycled ocean plastic."
    );
    const selectedPersonas = selectPersonas(scorePersonas(analysis, getPersonas()));
    const { recommendedPublishers } = scorePublishers(analysis, selectedPersonas, getPublishers());
    const topNames = recommendedPublishers.map((item) => item.publisher.name);

    expect(topNames.slice(0, 3)).toEqual(expect.arrayContaining(["Movewell", "Cloudfoot", "Stride & Stem"]));
  });
});
