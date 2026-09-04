import type { ExcludedPublisher, Publisher, ScoredPublisher } from "../../../types";
import type { PublisherRankingResponse } from "./schema";
import {
  clampScore,
  fillUniqueFromCandidates,
  nonEmptyArray,
  nonEmptySignals,
  normalizedScore
} from "../../shared/normalization";
import type { CampaignCandidates, CampaignCatalogue, LockedPublisherStrategy } from "../../types";

export function normalizePublisherStrategy(
  candidates: CampaignCandidates | CampaignCatalogue,
  ranking: PublisherRankingResponse
): LockedPublisherStrategy {
  const warnings = new Set([...candidates.warnings, ...ranking.warnings]);
  const publisherCandidateById = new Map(toPublisherCandidates(candidates).map((item) => [item.publisher.id, item]));
  const exclusionCandidateById = new Map(toExclusionCandidates(candidates).map((item) => [item.publisher.id, item]));
  const recommendedPublishers = normalizeRecommendedPublishers(ranking, publisherCandidateById, warnings);
  const recommendedIds = new Set(recommendedPublishers.map((item) => item.publisher.id));
  const excludedPublishers = normalizeExcludedPublishers(
    ranking,
    candidates,
    publisherCandidateById,
    exclusionCandidateById,
    recommendedIds,
    warnings
  );

  return {
    advertiserAnalysis: candidates.advertiserProfile,
    recommendedPublishers,
    excludedPublishers,
    warnings: Array.from(warnings)
  };
}

function toPublisherCandidates(candidates: CampaignCandidates | CampaignCatalogue): ScoredPublisher[] {
  if ("publisherCandidates" in candidates) {
    return candidates.publisherCandidates;
  }

  return candidates.publishers.map((publisher) => scoredPublisherFromCatalogue(publisher, 50));
}

function toExclusionCandidates(candidates: CampaignCandidates | CampaignCatalogue): ExcludedPublisher[] {
  if ("exclusionCandidates" in candidates) {
    return candidates.exclusionCandidates;
  }

  return candidates.publishers.map((publisher) => ({
    publisher,
    score: 20,
    reason: "Not selected by the publisher ranking stage.",
    signals: [
      {
        label: "Catalogue fallback",
        detail: "Available as an exclusion fallback if the model returns invalid or duplicate IDs.",
        weight: 20
      }
    ]
  }));
}

function scoredPublisherFromCatalogue(publisher: Publisher, score: number): ScoredPublisher {
  return {
    publisher,
    score,
    normalizedScore: normalizedScore(score),
    reasons: [`${publisher.name} is available in the supplied publisher catalogue.`],
    risks: [],
    signals: [
      {
        label: "Catalogue publisher",
        detail: "Publisher was supplied to the ranking stage.",
        weight: score
      }
    ]
  };
}

function normalizeRecommendedPublishers(
  ranking: PublisherRankingResponse,
  publisherCandidateById: Map<string, ScoredPublisher>,
  warnings: Set<string>
) {
  const seen = new Set<string>();
  const recommended = ranking.recommendedPublishers.flatMap((item) => {
    const candidate = publisherCandidateById.get(item.publisherId);

    if (!candidate || seen.has(item.publisherId)) {
      if (!candidate) {
        warnings.add(`Dropped recommended publisher outside candidate set: ${item.publisherId}.`);
      }
      return [];
    }

    seen.add(item.publisherId);
    return [
      {
        ...candidate,
        score: clampScore(item.score),
        normalizedScore: normalizedScore(item.score),
        reasons: nonEmptyArray(item.reasons, candidate.reasons[0]),
        risks: item.risks,
        signals: nonEmptySignals(item.signals, "Ranked publisher fit", item.score)
      }
    ];
  });

  fillUniqueFromCandidates({
    target: recommended,
    candidates: Array.from(publisherCandidateById.values()),
    getId: (item) => item.publisher.id,
    min: 3,
    max: 5,
    warnings,
    warning: "Filled recommended publishers from the supplied publisher catalogue."
  });

  return recommended.slice(0, 5);
}

function normalizeExcludedPublishers(
  ranking: PublisherRankingResponse,
  candidates: CampaignCandidates | CampaignCatalogue,
  publisherCandidateById: Map<string, ScoredPublisher>,
  exclusionCandidateById: Map<string, ExcludedPublisher>,
  recommendedIds: Set<string>,
  warnings: Set<string>
) {
  const seen = new Set<string>();
  const excluded = ranking.excludedPublishers.flatMap((item) => {
    const exclusionCandidate = exclusionCandidateById.get(item.publisherId);
    const publisherCandidate = publisherCandidateById.get(item.publisherId);
    const candidate = exclusionCandidate ?? publisherCandidate;

    if (!candidate || seen.has(item.publisherId) || recommendedIds.has(item.publisherId)) {
      if (!candidate) {
        warnings.add(`Dropped excluded publisher outside candidate set: ${item.publisherId}.`);
      }
      if (recommendedIds.has(item.publisherId)) {
        warnings.add(`Dropped excluded publisher already recommended: ${item.publisherId}.`);
      }
      return [];
    }

    seen.add(item.publisherId);
    return [
      {
        publisher: candidate.publisher,
        score: clampScore(item.score),
        reason: item.reason || exclusionCandidate?.reason || "Lower fit than selected publishers.",
        signals: nonEmptySignals(item.signals, "Ranked publisher exclusion", item.score)
      }
    ];
  });
  const exclusionFillCandidates = [
    ...toExclusionCandidates(candidates),
    ...toPublisherCandidates(candidates)
      .filter((item) => !recommendedIds.has(item.publisher.id))
      .map((item) => ({
        publisher: item.publisher,
        score: item.score,
        reason: item.risks[0] ?? "Lower priority than selected publishers.",
        signals: item.signals
      }))
  ];

  fillUniqueFromCandidates({
    target: excluded,
    candidates: exclusionFillCandidates.filter((item) => !recommendedIds.has(item.publisher.id)),
    getId: (item) => item.publisher.id,
    min: 3,
    max: 8,
    warnings,
    warning: "Filled excluded publishers from the supplied publisher catalogue."
  });

  return excluded.slice(0, 8);
}
