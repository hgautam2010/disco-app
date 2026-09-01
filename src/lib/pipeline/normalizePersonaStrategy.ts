import type { ScoredPersona } from "../types";
import { clampScore, fillUniqueFromFallback, nonEmptyArray, nonEmptySignals, normalizedScore } from "../openai/normalizationUtils";
import type { PersonaSelectionResponse } from "../validation/campaignSchemas";
import type { CampaignCandidates, LockedCampaignStrategy, LockedPublisherStrategy } from "./types";

export function deterministicPersonaStrategyFromCandidates(
  candidates: CampaignCandidates,
  publisherStrategy: LockedPublisherStrategy
): LockedCampaignStrategy {
  return {
    ...publisherStrategy,
    selectedPersonas: candidates.personaCandidates.slice(0, 5),
    warnings: Array.from(new Set([...publisherStrategy.warnings, ...candidates.warnings]))
  };
}

export function normalizePersonaStrategy(
  candidates: CampaignCandidates,
  publisherStrategy: LockedPublisherStrategy,
  selection: PersonaSelectionResponse
): LockedCampaignStrategy {
  const warnings = new Set([...publisherStrategy.warnings, ...candidates.warnings, ...selection.warnings]);
  const personaCandidateById = new Map(candidates.personaCandidates.map((item) => [item.persona.id, item]));
  const selectedPersonas = normalizeSelectedPersonas(selection, personaCandidateById, warnings);

  return {
    ...publisherStrategy,
    selectedPersonas,
    warnings: Array.from(warnings)
  };
}

function normalizeSelectedPersonas(
  selection: PersonaSelectionResponse,
  personaCandidateById: Map<string, ScoredPersona>,
  warnings: Set<string>
) {
  const seen = new Set<string>();
  const selected = selection.selectedPersonas.flatMap((item) => {
    const candidate = personaCandidateById.get(item.personaId);

    if (!candidate || seen.has(item.personaId)) {
      if (!candidate) {
        warnings.add(`Dropped persona outside candidate set: ${item.personaId}.`);
      }
      return [];
    }

    seen.add(item.personaId);
    return [
      {
        ...candidate,
        score: clampScore(item.score),
        normalizedScore: normalizedScore(item.score),
        reasons: nonEmptyArray(item.reasons, candidate.reasons[0]),
        risks: item.risks,
        messagingAngles: nonEmptyArray(
          item.messagingAngles,
          candidate.messagingAngles[0] ?? candidate.persona.messaging_preferences[0] ?? "clear product value"
        ),
        signals: nonEmptySignals(item.signals, "Selected persona fit", item.score)
      }
    ];
  });

  fillUniqueFromFallback({
    target: selected,
    fallback: Array.from(personaCandidateById.values()),
    getId: (item) => item.persona.id,
    min: 3,
    max: 5,
    warnings,
    warning: "Filled selected personas from deterministic candidate retrieval."
  });

  return selected.slice(0, 5);
}
