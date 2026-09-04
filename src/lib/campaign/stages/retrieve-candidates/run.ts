import { selectPersonas, scorePersonas } from "../../../personaScoring";
import { scorePublishers } from "../../../publisherScoring";
import { getVectorConfig } from "../../../vector/config";
import { emptyTokenUsage } from "../../shared/tokenUsage";
import { uniqueWarnings } from "../../shared/warnings";
import type { AdvertiserProfile, CampaignCandidates, PipelineStageResult } from "../../types";
import {
  buildExclusionCandidates,
  candidateWarnings,
  resolveCandidateRetrievalOptions,
  type CandidateRetrievalOptions
} from "./helpers";
import { retrieveCampaignCandidatesFromQdrant } from "./vectorRetriever";

export function retrieveCampaignCandidates(
  advertiserProfile: AdvertiserProfile,
  options: CandidateRetrievalOptions = {}
): PipelineStageResult<CampaignCandidates> {
  const startedAt = Date.now();
  const { publishers, personas, publisherCandidateLimit, personaCandidateLimit, exclusionCandidateLimit } =
    resolveCandidateRetrievalOptions(options);
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
      source: "deterministic",
      model: "code",
      promptInput: {
        advertiserProfile,
        publisherCandidateLimit,
        personaCandidateLimit,
        exclusionCandidateLimit
      },
      modelOutput: null,
      stageOutput: {
        publisherCandidates,
        personaCandidates,
        exclusionCandidates,
        warnings
      },
      durationMs: Date.now() - startedAt,
      apiCalls: 0,
      attempts: 0,
      tokenUsage: emptyTokenUsage(),
      repaired: false,
      warnings
    }
  };
}

export async function retrieveCampaignCandidatesForRuntime(
  advertiserProfile: AdvertiserProfile,
  options: CandidateRetrievalOptions = {}
): Promise<PipelineStageResult<CampaignCandidates>> {
  const vectorConfig = getVectorConfig();

  if (vectorConfig.retriever !== "qdrant") {
    return retrieveCampaignCandidates(advertiserProfile, options);
  }

  try {
    return await retrieveCampaignCandidatesFromQdrant(advertiserProfile, options, vectorConfig);
  } catch (error) {
    return withQdrantFallbackWarning(retrieveCampaignCandidates(advertiserProfile, options), error);
  }
}

function withQdrantFallbackWarning(
  fallback: PipelineStageResult<CampaignCandidates>,
  error: unknown
): PipelineStageResult<CampaignCandidates> {
  const fallbackReason = error instanceof Error ? error.message : "Unknown Qdrant retrieval error.";
  const warning = `Qdrant retrieval failed; fell back to local candidate retrieval. Reason: ${fallbackReason}`;
  const warnings = uniqueWarnings([...fallback.data.warnings, warning]);
  const data = {
    ...fallback.data,
    warnings
  };

  return {
    data,
    trace: {
      ...fallback.trace,
      promptInput: {
        requestedRetriever: "qdrant",
        fallbackReason,
        fallbackInput: fallback.trace.promptInput
      },
      stageOutput: {
        publisherCandidates: data.publisherCandidates,
        personaCandidates: data.personaCandidates,
        exclusionCandidates: data.exclusionCandidates,
        warnings
      },
      warnings
    }
  };
}
