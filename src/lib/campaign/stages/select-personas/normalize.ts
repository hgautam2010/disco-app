import type { Persona, ScoredPersona } from "../../../types";
import {
  clampScore,
  fillUniqueFromCandidates,
  nonEmptyArray,
  nonEmptySignals,
  normalizedScore
} from "../../shared/normalization";
import type { CampaignCandidates, CampaignCatalogue, LockedCampaignStrategy, LockedPublisherStrategy } from "../../types";
import type { PersonaSelectionResponse } from "./schema";

export function normalizePersonaStrategy(
  candidates: CampaignCandidates | CampaignCatalogue,
  publisherStrategy: LockedPublisherStrategy,
  selection: PersonaSelectionResponse
): LockedCampaignStrategy {
  const warnings = new Set([...publisherStrategy.warnings, ...candidates.warnings, ...selection.warnings]);
  const personaCandidateById = new Map(toPersonaCandidates(candidates).map((item) => [item.persona.id, item]));
  const selectedPersonas = normalizeSelectedPersonas(selection, personaCandidateById, warnings);

  return {
    ...publisherStrategy,
    selectedPersonas,
    warnings: Array.from(warnings)
  };
}

function toPersonaCandidates(candidates: CampaignCandidates | CampaignCatalogue): ScoredPersona[] {
  if ("personaCandidates" in candidates) {
    return candidates.personaCandidates;
  }

  return candidates.personas.map((persona) => scoredPersonaFromCatalogue(persona, 50));
}

function scoredPersonaFromCatalogue(persona: Persona, score: number): ScoredPersona {
  return {
    persona,
    score,
    normalizedScore: normalizedScore(score),
    reasons: [`${persona.name} is available in the supplied persona catalogue.`],
    risks: [],
    messagingAngles: nonEmptyArray(persona.messaging_preferences.slice(0, 2), "clear product value"),
    signals: [
      {
        label: "Catalogue persona",
        detail: "Persona was supplied to the selection stage.",
        weight: score
      }
    ]
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

  fillUniqueFromCandidates({
    target: selected,
    candidates: Array.from(personaCandidateById.values()),
    getId: (item) => item.persona.id,
    min: 3,
    max: 5,
    warnings,
    warning: "Filled selected personas from the supplied persona catalogue."
  });

  return selected.slice(0, 5);
}
