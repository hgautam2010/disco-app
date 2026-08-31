import { countKeywordMatches, tokenize } from "./advertiserParser";
import type { AdvertiserAnalysis, Persona, ScoredPersona, ScoreSignal } from "./types";

const categoryAffinityMap: Record<string, string[]> = {
  pet_food: ["pet_food", "pet_supplies", "pet_health", "subscription_boxes", "convenience"],
  sustainable_apparel: ["sustainable_apparel", "activewear", "fashion", "fitness"],
  functional_beverages: ["functional_beverages", "wellness", "fitness", "organic_grocery"],
  home_goods: ["home_goods", "home_decor", "premium_basics", "gourmet_food"],
  refillable_products: ["refillable_products", "home_goods", "household", "organic_grocery"],
  supplements: ["supplements", "fitness", "wellness", "recovery"],
  luxury_accessories: ["classic_apparel", "premium_basics", "apparel"],
  beauty: ["beauty", "clean_beauty", "fashion"],
  b2b_saas: [],
  wellness: ["wellness", "fitness", "organic_grocery"]
};

const priceFitMap: Record<string, string[]> = {
  budget: ["high"],
  value: ["high", "medium"],
  mid_market: ["medium", "medium-high", "low-medium"],
  premium: ["low-medium", "medium", "low"],
  luxury: ["low"],
  unknown: ["medium", "low-medium"]
};

export function scorePersonas(analysis: AdvertiserAnalysis, personas: Persona[]): ScoredPersona[] {
  const sourceText = [
    analysis.category,
    ...analysis.secondaryCategories,
    ...analysis.audienceHints,
    ...analysis.productSignals,
    ...analysis.valuePropositions
  ].join(" ");
  const sourceTokens = tokenize(sourceText);
  const targetAffinities = categoryAffinityMap[analysis.category] ?? [];

  return personas
    .map((persona) => scorePersona(analysis, persona, targetAffinities, sourceText, sourceTokens))
    .sort((a, b) => b.score - a.score);
}

export function selectPersonas(scoredPersonas: ScoredPersona[], maxCount = 4) {
  const strongMatches = scoredPersonas.filter((item) => item.score >= 35).slice(0, maxCount);
  return strongMatches.length >= 3 ? strongMatches : scoredPersonas.slice(0, Math.max(3, maxCount));
}

function scorePersona(
  analysis: AdvertiserAnalysis,
  persona: Persona,
  targetAffinities: string[],
  sourceText: string,
  sourceTokens: string[]
): ScoredPersona {
  const signals: ScoreSignal[] = [];
  const risks: string[] = [];
  const reasons: string[] = [];
  const messagingAngles: string[] = [];
  let score = 0;

  const affinityMatches = persona.category_affinities.filter((affinity) => targetAffinities.includes(affinity));
  if (affinityMatches.length > 0) {
    const weight = Math.min(38, 20 + affinityMatches.length * 8);
    score += weight;
    signals.push({
      label: "Category affinity",
      detail: `${persona.name} indexes on ${affinityMatches.join(", ")}.`,
      weight
    });
    reasons.push(`Category affinities match ${affinityMatches.join(", ")}.`);
  }

  const preferenceMatches = persona.messaging_preferences.filter((preference) =>
    sourceTokens.some((token) => preference.includes(token))
  );
  if (preferenceMatches.length > 0) {
    const weight = Math.min(16, preferenceMatches.length * 6);
    score += weight;
    signals.push({
      label: "Message preference",
      detail: `${persona.name} responds to ${preferenceMatches.join(", ")}.`,
      weight
    });
    messagingAngles.push(...preferenceMatches);
  }

  const descriptionMatch = countKeywordMatches(sourceText, tokenize(persona.description));
  if (descriptionMatch > 0) {
    const weight = Math.min(16, descriptionMatch * 2);
    score += weight;
    signals.push({
      label: "Audience language",
      detail: "Persona description overlaps with the advertiser's implied audience.",
      weight
    });
  }

  const acceptedPriceSensitivities = priceFitMap[analysis.priceTier] ?? priceFitMap.unknown;
  if (acceptedPriceSensitivities.includes(persona.price_sensitivity)) {
    score += 12;
    signals.push({
      label: "Price fit",
      detail: `${analysis.priceTier} positioning fits ${persona.price_sensitivity} price sensitivity.`,
      weight: 12
    });
    reasons.push("Price sensitivity is compatible with the offer.");
  }

  const signalPreferenceMatches = matchSignalsToPreferences(analysis.productSignals, persona.messaging_preferences);
  if (signalPreferenceMatches.length > 0) {
    const weight = Math.min(18, signalPreferenceMatches.length * 7);
    score += weight;
    signals.push({
      label: "Signal fit",
      detail: `Product signals support ${signalPreferenceMatches.join(", ")} messaging.`,
      weight
    });
    messagingAngles.push(...signalPreferenceMatches);
  }

  const disinterestMatches = persona.disinterested_in.filter((disinterest) =>
    hasExplicitDisinterestConflict(sourceText, disinterest)
  );
  if (disinterestMatches.length > 0) {
    const penalty = disinterestMatches.length * -18;
    score += penalty;
    signals.push({
      label: "Disinterest conflict",
      detail: `${persona.name} is less responsive to ${disinterestMatches.join(", ")}.`,
      weight: penalty
    });
    risks.push(`Potential conflict with ${disinterestMatches.join(", ")}.`);
  }

  if (analysis.ambiguityLevel === "high") {
    score -= 8;
    risks.push("Advertiser input is vague, so persona confidence is limited.");
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    persona,
    score: boundedScore,
    normalizedScore: boundedScore / 100,
    reasons: reasons.length > 0 ? reasons : ["General audience fit based on broad consumer behavior."],
    risks,
    messagingAngles: Array.from(new Set(messagingAngles)).slice(0, 4),
    signals
  };
}

function hasExplicitDisinterestConflict(sourceText: string, disinterest: string) {
  const normalizedDisinterest = disinterest.replaceAll("_", " ").toLowerCase();
  const meaningfulWords = normalizedDisinterest.split(/\s+/).filter((word) => word.length >= 5);

  if (sourceText.includes(normalizedDisinterest)) {
    return true;
  }

  if (normalizedDisinterest.includes("fast fashion") && sourceText.includes("fast fashion")) {
    return true;
  }

  return meaningfulWords.length >= 2 && meaningfulWords.every((word) => sourceText.includes(word));
}

function matchSignalsToPreferences(productSignals: string[], preferences: string[]) {
  const matches: string[] = [];

  if (productSignals.includes("science-backed") && preferences.some((preference) => preference.includes("science"))) {
    matches.push("science-backed claims");
  }

  if (productSignals.includes("sustainability") && preferences.some((preference) => preference.includes("sustainability"))) {
    matches.push("specific sustainability claims");
  }

  if (productSignals.includes("subscription") && preferences.some((preference) => preference.includes("subscription"))) {
    matches.push("subscription perks");
  }

  if (productSignals.includes("gifting") && preferences.some((preference) => preference.includes("gift"))) {
    matches.push("giftable");
  }

  if (productSignals.includes("value") && preferences.some((preference) => preference.includes("value"))) {
    matches.push("clear value props");
  }

  if (productSignals.includes("performance") && preferences.some((preference) => preference.includes("performance"))) {
    matches.push("performance claims");
  }

  return matches;
}
