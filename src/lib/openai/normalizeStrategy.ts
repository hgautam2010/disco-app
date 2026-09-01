import type { CampaignResult, ExcludedPublisher, Persona, Publisher, ScoredPersona, ScoredPublisher } from "../types";
import type { StrategyResponse } from "../validation/campaignSchemas";
import { clampScore, fillUniqueFromFallback, nonEmptyArray, nonEmptySignals, normalizedScore } from "./normalizationUtils";

export type NormalizedStrategy = Pick<
  CampaignResult,
  "advertiserAnalysis" | "recommendedPublishers" | "excludedPublishers" | "selectedPersonas" | "warnings"
>;

export function normalizeStrategy({
  advertiserDescription,
  baseline,
  strategy,
  publishers,
  personas
}: {
  advertiserDescription: string;
  baseline: CampaignResult;
  strategy: StrategyResponse;
  publishers: Publisher[];
  personas: Persona[];
}): NormalizedStrategy {
  const warnings = new Set([...baseline.warnings, ...strategy.warnings]);
  const publisherById = new Map(publishers.map((publisher) => [publisher.id, publisher]));
  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const recommendedPublishers = normalizeRecommendedPublishers(strategy, baseline, publisherById, warnings);
  const recommendedIds = new Set(recommendedPublishers.map((item) => item.publisher.id));
  const excludedPublishers = normalizeExcludedPublishers(strategy, baseline, publisherById, recommendedIds, warnings);
  const selectedPersonas = normalizeSelectedPersonas(strategy, baseline, personaById, warnings);

  return {
    advertiserAnalysis: {
      ...baseline.advertiserAnalysis,
      ...strategy.advertiserAnalysis,
      originalDescription: advertiserDescription
    },
    recommendedPublishers,
    excludedPublishers,
    selectedPersonas,
    warnings: Array.from(warnings)
  };
}

function normalizeRecommendedPublishers(
  strategy: StrategyResponse,
  baseline: CampaignResult,
  publisherById: Map<string, Publisher>,
  warnings: Set<string>
): ScoredPublisher[] {
  const seen = new Set<string>();
  const recommended = strategy.recommendedPublishers.flatMap((item) => {
    const publisher = publisherById.get(item.publisherId);

    if (!publisher || seen.has(item.publisherId)) {
      if (!publisher) {
        warnings.add(`Dropped unknown recommended publisher id: ${item.publisherId}.`);
      }
      return [];
    }

    seen.add(item.publisherId);
    return [
      {
        publisher,
        score: clampScore(item.score),
        normalizedScore: normalizedScore(item.score),
        reasons: nonEmptyArray(item.reasons, "Model selected this publisher during strategy generation."),
        risks: item.risks,
        signals: nonEmptySignals(item.signals, "Strategy publisher fit", item.score)
      }
    ];
  });

  fillUniqueFromFallback({
    target: recommended,
    fallback: baseline.recommendedPublishers,
    getId: (item) => item.publisher.id,
    min: 3,
    max: 5,
    warnings,
    warning: "Added deterministic publisher fallback to keep at least 3 recommendations."
  });

  return recommended.slice(0, 5);
}

function normalizeExcludedPublishers(
  strategy: StrategyResponse,
  baseline: CampaignResult,
  publisherById: Map<string, Publisher>,
  recommendedIds: Set<string>,
  warnings: Set<string>
): ExcludedPublisher[] {
  const seen = new Set<string>();
  const excluded = strategy.excludedPublishers.flatMap((item) => {
    const publisher = publisherById.get(item.publisherId);

    if (!publisher || seen.has(item.publisherId) || recommendedIds.has(item.publisherId)) {
      if (!publisher) {
        warnings.add(`Dropped unknown excluded publisher id: ${item.publisherId}.`);
      }
      if (recommendedIds.has(item.publisherId)) {
        warnings.add(`Dropped excluded publisher already recommended: ${item.publisherId}.`);
      }
      return [];
    }

    seen.add(item.publisherId);
    return [
      {
        publisher,
        score: clampScore(item.score),
        reason: item.reason || "Not a strong fit compared with recommended publishers.",
        signals: nonEmptySignals(item.signals, "Strategy publisher exclusion", item.score)
      }
    ];
  });

  fillUniqueFromFallback({
    target: excluded,
    fallback: baseline.excludedPublishers.filter((item) => !recommendedIds.has(item.publisher.id)),
    getId: (item) => item.publisher.id,
    min: 3,
    max: 8,
    warnings,
    warning: "Added deterministic exclusion fallback to keep at least 3 exclusions."
  });

  return excluded.slice(0, 8);
}

function normalizeSelectedPersonas(
  strategy: StrategyResponse,
  baseline: CampaignResult,
  personaById: Map<string, Persona>,
  warnings: Set<string>
): ScoredPersona[] {
  const seen = new Set<string>();
  const selected = strategy.selectedPersonas.flatMap((item) => {
    const persona = personaById.get(item.personaId);

    if (!persona || seen.has(item.personaId)) {
      if (!persona) {
        warnings.add(`Dropped unknown persona id: ${item.personaId}.`);
      }
      return [];
    }

    seen.add(item.personaId);
    return [
      {
        persona,
        score: clampScore(item.score),
        normalizedScore: normalizedScore(item.score),
        reasons: nonEmptyArray(item.reasons, "Model selected this persona during strategy generation."),
        risks: item.risks,
        messagingAngles: item.messagingAngles,
        signals: nonEmptySignals(item.signals, "Strategy persona fit", item.score)
      }
    ];
  });

  fillUniqueFromFallback({
    target: selected,
    fallback: baseline.selectedPersonas,
    getId: (item) => item.persona.id,
    min: 3,
    max: 5,
    warnings,
    warning: "Added deterministic persona fallback to keep at least 3 personas."
  });

  return selected.slice(0, 5);
}
