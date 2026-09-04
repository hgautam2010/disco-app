import { getPersonas, getPublishers } from "../../../data";
import type { AdvertiserProfile } from "../../types";
import type { ExcludedPublisher, Persona, Publisher, ScoredPersona, ScoredPublisher } from "../../../types";

export const defaultPublisherCandidateLimit = 10;
export const defaultPersonaCandidateLimit = 8;
export const defaultExclusionCandidateLimit = 8;

export type CandidateRetrievalOptions = {
  publishers?: Publisher[];
  personas?: Persona[];
  publisherCandidateLimit?: number;
  personaCandidateLimit?: number;
  exclusionCandidateLimit?: number;
};

export type ResolvedCandidateRetrievalOptions = {
  publishers: Publisher[];
  personas: Persona[];
  publisherCandidateLimit: number;
  personaCandidateLimit: number;
  exclusionCandidateLimit: number;
};

export function resolveCandidateRetrievalOptions(
  options: CandidateRetrievalOptions = {}
): ResolvedCandidateRetrievalOptions {
  return {
    publishers: options.publishers ?? getPublishers(),
    personas: options.personas ?? getPersonas(),
    publisherCandidateLimit: options.publisherCandidateLimit ?? defaultPublisherCandidateLimit,
    personaCandidateLimit: options.personaCandidateLimit ?? defaultPersonaCandidateLimit,
    exclusionCandidateLimit: options.exclusionCandidateLimit ?? defaultExclusionCandidateLimit
  };
}

export function buildExclusionCandidates(
  allPublisherScores: ScoredPublisher[],
  publisherCandidates: ScoredPublisher[],
  limit: number
): ExcludedPublisher[] {
  const candidateIds = new Set(publisherCandidates.map((item) => item.publisher.id));

  return allPublisherScores
    .filter((item) => !candidateIds.has(item.publisher.id))
    .slice(-Math.max(3, limit))
    .reverse()
    .map((item) => ({
      publisher: item.publisher,
      score: item.score,
      reason: exclusionReasonFor(item),
      signals: item.signals
    }));
}

export function candidateWarnings(
  advertiserProfile: AdvertiserProfile,
  publisherCandidates: ScoredPublisher[],
  personaCandidates: ScoredPersona[]
) {
  const warnings: string[] = [];

  if (advertiserProfile.category === "b2b_saas") {
    warnings.push("Publisher catalog is consumer-commerce oriented; B2B recommendations are directional.");
  }

  if (publisherCandidates.length < 5) {
    warnings.push("Publisher candidate pool is narrow; strategy should use conservative budgets.");
  }

  if (personaCandidates.length < 5) {
    warnings.push("Persona candidate pool is narrow; creative should avoid over-specific audience claims.");
  }

  return warnings;
}

function exclusionReasonFor(item: ScoredPublisher) {
  if (item.risks.length > 0) {
    return item.risks[0];
  }

  if (item.signals.length === 0) {
    return "No meaningful category, audience, or product-signal overlap with the advertiser profile.";
  }

  return "Lower fit than the retrieved publisher candidate set.";
}
