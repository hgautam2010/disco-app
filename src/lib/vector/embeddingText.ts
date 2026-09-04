import type { AdvertiserAnalysis, Persona, Publisher } from "../types";

export const publisherEmbeddingTextVersion = "publisher-v1";
export const personaEmbeddingTextVersion = "persona-v1";
export const advertiserQueryTextVersion = "advertiser-query-v1";

export function publisherToEmbeddingText(publisher: Publisher) {
  return compactLines([
    `Publisher: ${publisher.name}`,
    `Category: ${publisher.category}`,
    `Subcategories: ${formatList(publisher.subcategories)}`,
    `Audience age skew: ${publisher.audience.age_skew}`,
    `Audience income tier: ${publisher.audience.income_tier}`,
    `Audience geos: ${formatList(publisher.audience.top_geos)}`,
    `Average order value USD: ${publisher.avg_order_value_usd}`,
    `Monthly impressions: ${publisher.monthly_impressions}`,
    `Notes: ${publisher.notes}`
  ]);
}

export function personaToEmbeddingText(persona: Persona) {
  return compactLines([
    `Persona: ${persona.name}`,
    `Age range: ${persona.age_range}`,
    `Gender skew: ${persona.gender_skew}`,
    `Description: ${persona.description}`,
    `Category affinities: ${formatList(persona.category_affinities)}`,
    `Price sensitivity: ${persona.price_sensitivity}`,
    `Messaging preferences: ${formatList(persona.messaging_preferences)}`,
    `Disinterested in: ${formatList(persona.disinterested_in)}`,
    `Typical average order value USD: ${persona.typical_aov_usd}`
  ]);
}

export function advertiserToRetrievalQuery(advertiser: AdvertiserAnalysis) {
  return compactLines([
    `Advertiser pitch: ${advertiser.originalDescription}`,
    `Primary category: ${advertiser.category}`,
    `Secondary categories: ${formatList(advertiser.secondaryCategories)}`,
    `Price tier: ${advertiser.priceTier}`,
    `Audience hints: ${formatList(advertiser.audienceHints)}`,
    `Product signals: ${formatList(advertiser.productSignals)}`,
    `Value propositions: ${formatList(advertiser.valuePropositions)}`,
    `Purchase model: ${advertiser.purchaseModel}`,
    `Likely objective: ${advertiser.likelyObjective}`,
    `Ambiguity level: ${advertiser.ambiguityLevel}`
  ]);
}

function compactLines(lines: string[]) {
  return lines.filter((line) => !line.endsWith(": ")).join("\n");
}

function formatList(values: string[] | readonly string[]) {
  return values.length > 0 ? values.join(", ") : "none";
}
