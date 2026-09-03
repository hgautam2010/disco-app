import type { ExcludedPublisher, ScoredPublisher } from "../../../types";
import type { PublisherRankingResponse } from "./schema";
import {
  clampScore,
  fillUniqueFromCandidates,
  nonEmptyArray,
  nonEmptySignals,
  normalizedScore
} from "../../shared/normalization";
import type { CampaignCandidates, LockedPublisherStrategy } from "../../types";

export function normalizePublisherStrategy(
  candidates: CampaignCandidates,
  ranking: PublisherRankingResponse
): LockedPublisherStrategy {
  const warnings = new Set([...candidates.warnings, ...ranking.warnings]);
  const publisherCandidateById = new Map(candidates.publisherCandidates.map((item) => [item.publisher.id, item]));
  const exclusionCandidateById = new Map(candidates.exclusionCandidates.map((item) => [item.publisher.id, item]));
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
    warning: "Filled recommended publishers from deterministic candidate retrieval."
  });

  return recommended.slice(0, 5);
}

function normalizeExcludedPublishers(
  ranking: PublisherRankingResponse,
  candidates: CampaignCandidates,
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
    ...candidates.exclusionCandidates,
    ...candidates.publisherCandidates
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
    warning: "Filled excluded publishers from deterministic candidate retrieval."
  });

  return excluded.slice(0, 8);
}
