import { countKeywordMatches, tokenize } from "./advertiserParser";
import type {
  AdvertiserAnalysis,
  ExcludedPublisher,
  Publisher,
  ScoredPersona,
  ScoredPublisher,
  ScoreSignal
} from "./types";

const categoryPublisherMap: Record<string, string[]> = {
  pet_food: ["pet", "pet_food", "pet_supplies", "pet_pharmacy", "subscription", "treats", "toys"],
  sustainable_apparel: ["apparel", "activewear", "sustainable", "women", "shoes"],
  functional_beverages: ["beverages", "functional_beverages", "soda_alternative", "gut_health", "groceries", "wellness_dtc"],
  home_goods: ["home", "bedding", "bath", "home_textiles", "cookware", "kitchen", "gifting"],
  refillable_products: ["home", "household", "non_toxic", "organic", "natural", "groceries"],
  supplements: ["wellness_dtc", "supplements", "vitamins", "fitness_classes", "activewear"],
  luxury_accessories: ["apparel", "classic", "women", "workwear", "gifting"],
  beauty: ["beauty", "skincare", "makeup", "haircare", "personalized"],
  b2b_saas: [],
  wellness: ["wellness_dtc", "wellness_services", "supplements", "organic", "natural", "spa", "yoga"]
};

const incomeFitMap: Record<string, string[]> = {
  budget: ["mid"],
  value: ["mid", "mid-high"],
  mid_market: ["mid", "mid-high", "high"],
  premium: ["mid-high", "high"],
  luxury: ["high"],
  unknown: ["mid", "mid-high"]
};

export function scorePublishers(
  analysis: AdvertiserAnalysis,
  selectedPersonas: ScoredPersona[],
  publishers: Publisher[]
) {
  const scored = publishers
    .map((publisher) => scorePublisher(analysis, selectedPersonas, publisher))
    .sort((a, b) => b.score - a.score);

  const strongRecommendations = scored.filter((item) => item.score >= 45);
  const recommendedPublishers =
    strongRecommendations.length >= 3 ? strongRecommendations.slice(0, 5) : scored.slice(0, 3);
  const excludedPublishers = buildExcludedPublishers(scored, recommendedPublishers);

  return {
    allPublishers: scored,
    recommendedPublishers,
    excludedPublishers
  };
}

function scorePublisher(
  analysis: AdvertiserAnalysis,
  selectedPersonas: ScoredPersona[],
  publisher: Publisher
): ScoredPublisher {
  const signals: ScoreSignal[] = [];
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = 0;

  const targets = categoryPublisherMap[analysis.category] ?? [];
  const publisherTaxonomy = [publisher.category, ...publisher.subcategories];
  const taxonomyMatches = publisherTaxonomy.filter((item) => targets.includes(item));

  if (taxonomyMatches.includes(publisher.category)) {
    score += 32;
    signals.push({
      label: "Primary category",
      detail: `${publisher.name} is a ${publisher.category} publisher.`,
      weight: 32
    });
    reasons.push(`Primary category aligns with ${analysis.category}.`);
  }

  const subcategoryMatches = publisher.subcategories.filter((item) => targets.includes(item));
  if (subcategoryMatches.length > 0) {
    const weight = Math.min(30, subcategoryMatches.length * 10);
    score += weight;
    signals.push({
      label: "Subcategory fit",
      detail: `Matches ${subcategoryMatches.join(", ")}.`,
      weight
    });
    reasons.push(`Subcategory fit through ${subcategoryMatches.join(", ")}.`);
  }

  const noteText = `${publisher.notes} ${publisher.subcategories.join(" ")}`.toLowerCase();
  const noteMatches = countKeywordMatches(
    noteText,
    [...analysis.productSignals, ...analysis.valuePropositions, ...analysis.audienceHints].flatMap(tokenize)
  );
  if (noteMatches > 0) {
    const weight = Math.min(16, noteMatches * 3);
    score += weight;
    signals.push({
      label: "Catalog notes",
      detail: `${publisher.name}'s notes echo the advertiser's signal language.`,
      weight
    });
  }

  const personaOverlap = scorePersonaOverlap(selectedPersonas, publisher);
  if (personaOverlap > 0) {
    score += personaOverlap;
    signals.push({
      label: "Persona overlap",
      detail: "Audience profile overlaps with selected shopper personas.",
      weight: personaOverlap
    });
  }

  const acceptedIncomeTiers = incomeFitMap[analysis.priceTier] ?? incomeFitMap.unknown;
  if (acceptedIncomeTiers.includes(publisher.audience.income_tier)) {
    score += 8;
    signals.push({
      label: "Income fit",
      detail: `${publisher.audience.income_tier} audience fits ${analysis.priceTier} pricing.`,
      weight: 8
    });
    reasons.push("Audience income tier supports the offer price.");
  } else if (analysis.priceTier === "luxury" && publisher.audience.income_tier !== "high") {
    score -= 14;
    risks.push("Luxury price point may exceed this publisher's usual buying context.");
  }

  if (publisher.monthly_impressions >= 30000000) {
    score += 4;
    signals.push({
      label: "Reach",
      detail: "Large monthly impression base can support scale testing.",
      weight: 4
    });
  }

  if (analysis.category === "b2b_saas") {
    score -= 28;
    risks.push("Catalog is consumer commerce oriented, not B2B lead generation oriented.");
  }

  if (analysis.ambiguityLevel === "high") {
    score -= 6;
    risks.push("Low-signal advertiser input lowers match confidence.");
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    publisher,
    score: boundedScore,
    normalizedScore: boundedScore / 100,
    reasons: reasons.length > 0 ? reasons : ["Broad audience fit, but no strong catalog match."],
    risks,
    signals
  };
}

function scorePersonaOverlap(selectedPersonas: ScoredPersona[], publisher: Publisher) {
  const publisherTerms = tokenize(`${publisher.category} ${publisher.subcategories.join(" ")} ${publisher.notes}`);

  return selectedPersonas.reduce((total, scoredPersona) => {
    const overlap = scoredPersona.persona.category_affinities.filter((affinity) =>
      publisherTerms.includes(affinity) || publisherTerms.some((term) => affinity.includes(term))
    );
    return total + Math.min(4, overlap.length * 2);
  }, 0);
}

function buildExcludedPublishers(
  scoredPublishers: ScoredPublisher[],
  recommendedPublishers: ScoredPublisher[]
): ExcludedPublisher[] {
  const recommendedIds = new Set(recommendedPublishers.map((item) => item.publisher.id));
  return scoredPublishers
    .filter((item) => !recommendedIds.has(item.publisher.id))
    .slice(-5)
    .reverse()
    .map((item) => ({
      publisher: item.publisher,
      score: item.score,
      reason: strongestExclusionReason(item),
      signals: item.signals
    }));
}

function strongestExclusionReason(item: ScoredPublisher) {
  if (item.risks.length > 0) {
    return item.risks[0];
  }

  const positiveSignals = item.signals.filter((signal) => signal.weight > 0);
  if (positiveSignals.length === 0) {
    return "No meaningful category, audience, or signal overlap with the advertiser.";
  }

  return "Some generic fit exists, but stronger publishers have more direct audience and category alignment.";
}
