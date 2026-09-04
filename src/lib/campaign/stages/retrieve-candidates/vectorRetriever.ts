import { selectPersonas, scorePersonas } from "../../../personaScoring";
import { scorePublishers } from "../../../publisherScoring";
import type { ScoredPersona, ScoredPublisher } from "../../../types";
import { advertiserToRetrievalQuery, advertiserQueryTextVersion } from "../../../vector/embeddingText";
import { createEmbedding, type EmbeddingUsage } from "../../../vector/openaiEmbeddings";
import type { VectorConfig } from "../../../vector/config";
import { searchQdrant, type QdrantSearchHit } from "../../../vector/qdrantClient";
import { clampScore, normalizedScore } from "../../shared/normalization";
import { emptyTokenUsage } from "../../shared/tokenUsage";
import { uniqueWarnings } from "../../shared/warnings";
import type { AdvertiserProfile, CampaignCandidates, PipelineStageResult } from "../../types";
import {
  buildExclusionCandidates,
  candidateWarnings,
  resolveCandidateRetrievalOptions,
  type CandidateRetrievalOptions
} from "./helpers";

export async function retrieveCampaignCandidatesFromQdrant(
  advertiserProfile: AdvertiserProfile,
  options: CandidateRetrievalOptions,
  config: VectorConfig
): Promise<PipelineStageResult<CampaignCandidates>> {
  const startedAt = Date.now();
  const { publishers, personas, publisherCandidateLimit, personaCandidateLimit, exclusionCandidateLimit } =
    resolveCandidateRetrievalOptions(options);
  const retrievalQuery = advertiserToRetrievalQuery(advertiserProfile);
  const queryEmbedding = await createEmbedding(retrievalQuery, config);
  const publisherLimit = Math.max(5, publisherCandidateLimit);
  const personaLimit = Math.max(5, personaCandidateLimit);
  const [publisherHits, personaHits] = await Promise.all([
    searchQdrant(config.publishersCollection, queryEmbedding.embedding, publisherLimit, config),
    searchQdrant(config.personasCollection, queryEmbedding.embedding, personaLimit, config)
  ]);
  const scoredPersonas = scorePersonas(advertiserProfile, personas);
  const {
    candidates: personaCandidates,
    warnings: personaWarnings,
    filledFromLocal: filledPersonaCount
  } = buildVectorPersonaCandidates(scoredPersonas, personaHits, personaLimit);
  if (personaCandidates.length === filledPersonaCount) {
    throw new Error("Qdrant persona retrieval returned no valid catalog hits. Run npm run ingest:qdrant.");
  }

  const publisherPersonaSeed = selectPersonas(personaCandidates.length >= 3 ? personaCandidates : scoredPersonas, 5);
  const publisherScores = scorePublishers(advertiserProfile, publisherPersonaSeed, publishers);
  const {
    candidates: publisherCandidates,
    warnings: publisherWarnings,
    filledFromLocal: filledPublisherCount
  } = buildVectorPublisherCandidates(publisherScores.allPublishers, publisherHits, publisherLimit);
  if (publisherCandidates.length === filledPublisherCount) {
    throw new Error("Qdrant publisher retrieval returned no valid catalog hits. Run npm run ingest:qdrant.");
  }

  const exclusionCandidates = buildExclusionCandidates(
    publisherScores.allPublishers,
    publisherCandidates,
    exclusionCandidateLimit
  );
  const warnings = uniqueWarnings([
    ...candidateWarnings(advertiserProfile, publisherCandidates, personaCandidates),
    ...publisherWarnings,
    ...personaWarnings
  ]);
  const data = {
    advertiserProfile,
    publisherCandidates,
    personaCandidates,
    exclusionCandidates,
    warnings
  };

  return {
    data,
    trace: {
      name: "retrieve",
      source: "qdrant",
      model: queryEmbedding.model,
      promptInput: {
        retriever: "qdrant",
        advertiserProfile,
        retrievalQuery,
        queryTextVersion: advertiserQueryTextVersion,
        publisherCandidateLimit,
        personaCandidateLimit,
        exclusionCandidateLimit,
        collections: {
          publishers: config.publishersCollection,
          personas: config.personasCollection
        }
      },
      modelOutput: {
        embedding: {
          model: queryEmbedding.model,
          dimensions: queryEmbedding.embedding.length,
          tokenUsage: queryEmbedding.usage
        },
        publisherHits: publisherHits.map(toHitSummary),
        personaHits: personaHits.map(toHitSummary),
        filledFromLocal: {
          publishers: filledPublisherCount,
          personas: filledPersonaCount
        }
      },
      stageOutput: {
        publisherCandidates,
        personaCandidates,
        exclusionCandidates,
        warnings
      },
      durationMs: Date.now() - startedAt,
      apiCalls: 1,
      attempts: 1,
      tokenUsage: embeddingUsageToTokenUsage(queryEmbedding.usage),
      repaired: false,
      warnings
    }
  };
}

function buildVectorPublisherCandidates(
  scoredPublishers: ScoredPublisher[],
  hits: QdrantSearchHit[],
  limit: number
) {
  const publisherById = new Map(scoredPublishers.map((item) => [item.publisher.id, item]));
  const selected: ScoredPublisher[] = [];
  const selectedIds = new Set<string>();
  const warnings: string[] = [];

  for (const hit of hits) {
    const sourceId = sourceIdFromHit(hit);

    if (!sourceId || selectedIds.has(sourceId)) {
      continue;
    }

    const scoredPublisher = publisherById.get(sourceId);
    if (!scoredPublisher) {
      warnings.push(`Qdrant returned unknown publisher ID ${sourceId}.`);
      continue;
    }

    selected.push(withPublisherSemanticSignal(scoredPublisher, hit.score));
    selectedIds.add(sourceId);
  }

  const filledFromLocal = fillFromLocalScores(selected, selectedIds, scoredPublishers, limit);
  if (filledFromLocal > 0) {
    warnings.push("Qdrant returned too few valid publisher hits; filled remaining candidates with local scoring.");
  }

  return {
    candidates: selected.sort((a, b) => b.score - a.score).slice(0, limit),
    warnings,
    filledFromLocal
  };
}

function buildVectorPersonaCandidates(scoredPersonas: ScoredPersona[], hits: QdrantSearchHit[], limit: number) {
  const personaById = new Map(scoredPersonas.map((item) => [item.persona.id, item]));
  const selected: ScoredPersona[] = [];
  const selectedIds = new Set<string>();
  const warnings: string[] = [];

  for (const hit of hits) {
    const sourceId = sourceIdFromHit(hit);

    if (!sourceId || selectedIds.has(sourceId)) {
      continue;
    }

    const scoredPersona = personaById.get(sourceId);
    if (!scoredPersona) {
      warnings.push(`Qdrant returned unknown persona ID ${sourceId}.`);
      continue;
    }

    selected.push(withPersonaSemanticSignal(scoredPersona, hit.score));
    selectedIds.add(sourceId);
  }

  const filledFromLocal = fillFromLocalScores(selected, selectedIds, scoredPersonas, limit);
  if (filledFromLocal > 0) {
    warnings.push("Qdrant returned too few valid persona hits; filled remaining candidates with local scoring.");
  }

  return {
    candidates: selected.sort((a, b) => b.score - a.score).slice(0, limit),
    warnings,
    filledFromLocal
  };
}

function fillFromLocalScores<T extends ScoredPersona | ScoredPublisher>(
  selected: T[],
  selectedIds: Set<string>,
  localScores: T[],
  limit: number
) {
  const initialCount = selected.length;

  for (const item of localScores) {
    if (selected.length >= limit) {
      break;
    }

    const id = "persona" in item ? item.persona.id : item.publisher.id;
    if (!selectedIds.has(id)) {
      selected.push(item);
      selectedIds.add(id);
    }
  }

  return selected.length - initialCount;
}

function withPublisherSemanticSignal(item: ScoredPublisher, similarity: number): ScoredPublisher {
  const boost = semanticBoost(similarity);
  const score = clampScore(item.score + boost);

  return {
    ...item,
    score,
    normalizedScore: normalizedScore(score),
    reasons: uniqueStrings(["Semantic vector search matched this publisher to the advertiser query.", ...item.reasons]),
    signals: [semanticSignal(similarity, boost), ...item.signals]
  };
}

function withPersonaSemanticSignal(item: ScoredPersona, similarity: number): ScoredPersona {
  const boost = semanticBoost(similarity);
  const score = clampScore(item.score + boost);

  return {
    ...item,
    score,
    normalizedScore: normalizedScore(score),
    reasons: uniqueStrings(["Semantic vector search matched this persona to the advertiser query.", ...item.reasons]),
    signals: [semanticSignal(similarity, boost), ...item.signals]
  };
}

function semanticSignal(similarity: number, weight: number) {
  return {
    label: "Semantic retrieval",
    detail: `Qdrant cosine similarity ${formatSimilarity(similarity)} for the advertiser query.`,
    weight
  };
}

function semanticBoost(similarity: number) {
  return clampScore(Math.max(0, similarity) * 20);
}

function sourceIdFromHit(hit: QdrantSearchHit) {
  return typeof hit.payload.sourceId === "string" ? hit.payload.sourceId : undefined;
}

function toHitSummary(hit: QdrantSearchHit) {
  return {
    id: hit.id,
    sourceId: sourceIdFromHit(hit),
    name: typeof hit.payload.name === "string" ? hit.payload.name : undefined,
    score: Number(hit.score.toFixed(4))
  };
}

function embeddingUsageToTokenUsage(usage: EmbeddingUsage) {
  return {
    ...emptyTokenUsage(),
    inputTokens: usage.inputTokens,
    totalTokens: usage.totalTokens
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function formatSimilarity(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}
