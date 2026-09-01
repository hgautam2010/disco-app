import { getPersonas, getPublishers } from "../../../data";
import { selectPersonas, scorePersonas } from "../../../personaScoring";
import { scorePublishers } from "../../../publisherScoring";
import type { ExcludedPublisher, Persona, Publisher, ScoredPersona, ScoredPublisher } from "../../../types";
import type { AdvertiserProfile, CampaignCandidates, PipelineStageResult } from "../../types";

const defaultPublisherCandidateLimit = 10;
const defaultPersonaCandidateLimit = 8;
const defaultExclusionCandidateLimit = 8;

export function retrieveCampaignCandidates(
  advertiserProfile: AdvertiserProfile,
  options: {
    publishers?: Publisher[];
    personas?: Persona[];
    publisherCandidateLimit?: number;
    personaCandidateLimit?: number;
    exclusionCandidateLimit?: number;
  } = {}
): PipelineStageResult<CampaignCandidates> {
  const startedAt = Date.now();
  const publishers = options.publishers ?? getPublishers();
  const personas = options.personas ?? getPersonas();
  const personaCandidateLimit = options.personaCandidateLimit ?? defaultPersonaCandidateLimit;
  const publisherCandidateLimit = options.publisherCandidateLimit ?? defaultPublisherCandidateLimit;
  const exclusionCandidateLimit = options.exclusionCandidateLimit ?? defaultExclusionCandidateLimit;
  const scoredPersonas = scorePersonas(advertiserProfile, personas);
  const personaCandidates = scoredPersonas.slice(0, Math.max(5, personaCandidateLimit));
  const publisherPersonaSeed = selectPersonas(scoredPersonas, 5);
  const publisherScores = scorePublishers(advertiserProfile, publisherPersonaSeed, publishers);
  const publisherCandidates = publisherScores.allPublishers.slice(0, Math.max(5, publisherCandidateLimit));
  const exclusionCandidates = buildExclusionCandidates(
    publisherScores.allPublishers,
    publisherCandidates,
    exclusionCandidateLimit
  );
  const warnings = candidateWarnings(advertiserProfile, publisherCandidates, personaCandidates);

  return {
    data: {
      advertiserProfile,
      publisherCandidates,
      personaCandidates,
      exclusionCandidates,
      warnings
    },
    trace: {
      name: "retrieve",
      source: "deterministic",
      durationMs: Date.now() - startedAt,
      apiCalls: 0,
      repaired: false,
      warnings
    }
  };
}

function buildExclusionCandidates(
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

function exclusionReasonFor(item: ScoredPublisher) {
  if (item.risks.length > 0) {
    return item.risks[0];
  }

  if (item.signals.length === 0) {
    return "No meaningful category, audience, or product-signal overlap with the advertiser profile.";
  }

  return "Lower fit than the retrieved publisher candidate set.";
}

function candidateWarnings(
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
