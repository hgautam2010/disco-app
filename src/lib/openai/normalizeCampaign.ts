import { generateFallbackCreative } from "../creativeGenerator";
import type {
  AdvertiserAnalysis,
  CampaignConfig,
  CampaignResult,
  CreativeVariant,
  ExcludedPublisher,
  Persona,
  Publisher,
  PublisherBudgetAllocation,
  ScoredPersona,
  ScoredPublisher,
  ScoreSignal
} from "../types";

export type InlineCampaignDraft = {
  advertiserAnalysis: Omit<AdvertiserAnalysis, "originalDescription">;
  recommendedPublishers: {
    publisherId: string;
    score: number;
    reasons: string[];
    risks: string[];
    signals: ScoreSignal[];
  }[];
  excludedPublishers: {
    publisherId: string;
    score: number;
    reason: string;
    signals: ScoreSignal[];
  }[];
  selectedPersonas: {
    personaId: string;
    score: number;
    reasons: string[];
    risks: string[];
    messagingAngles: string[];
    signals: ScoreSignal[];
  }[];
  creativeVariants: CreativeVariant[];
  campaignConfig: CampaignConfig;
  warnings: string[];
};

export function normalizeInlineCampaignDraft(
  advertiserDescription: string,
  baseline: CampaignResult,
  draft: InlineCampaignDraft,
  publishers: Publisher[],
  personas: Persona[]
): CampaignResult {
  const publisherById = new Map(publishers.map((publisher) => [publisher.id, publisher]));
  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const warnings = new Set(draft.warnings);

  const recommendedPublishers = normalizeRecommendedPublishers(draft, baseline, publisherById, warnings);
  const recommendedIds = new Set(recommendedPublishers.map((item) => item.publisher.id));
  const selectedPersonas = normalizeSelectedPersonas(draft, baseline, personaById, warnings);
  const selectedPersonaIds = new Set(selectedPersonas.map((item) => item.persona.id));
  const advertiserAnalysis = {
    ...baseline.advertiserAnalysis,
    ...draft.advertiserAnalysis,
    originalDescription: advertiserDescription
  };
  const creativeVariants = normalizeCreativeVariants(
    draft.creativeVariants,
    baseline,
    advertiserAnalysis,
    selectedPersonas,
    selectedPersonaIds,
    warnings
  );
  const excludedPublishers = normalizeExcludedPublishers(draft, baseline, publisherById, recommendedIds, warnings);

  return {
    mode: "openai_inline",
    generatedAt: baseline.generatedAt,
    advertiserAnalysis,
    recommendedPublishers,
    excludedPublishers,
    selectedPersonas,
    creativeVariants,
    campaignConfig: normalizeCampaignConfig(draft.campaignConfig, baseline, recommendedPublishers, warnings),
    warnings: Array.from(warnings)
  };
}

function normalizeRecommendedPublishers(
  draft: InlineCampaignDraft,
  baseline: CampaignResult,
  publisherById: Map<string, Publisher>,
  warnings: Set<string>
): ScoredPublisher[] {
  const seen = new Set<string>();
  const recommended = draft.recommendedPublishers.flatMap((item) => {
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
        normalizedScore: clampScore(item.score) / 100,
        reasons: nonEmptyArray(item.reasons, "Model selected this publisher from the full catalog."),
        risks: item.risks,
        signals: nonEmptySignals(item.signals, "Full-catalog model fit", item.score)
      }
    ];
  });

  fillFromBaseline(
    recommended,
    baseline.recommendedPublishers,
    (item) => item.publisher.id,
    3,
    5,
    warnings,
    "Added deterministic publisher fallback to keep at least 3 recommendations."
  );

  return recommended.slice(0, 5);
}

function normalizeExcludedPublishers(
  draft: InlineCampaignDraft,
  baseline: CampaignResult,
  publisherById: Map<string, Publisher>,
  recommendedIds: Set<string>,
  warnings: Set<string>
): ExcludedPublisher[] {
  const seen = new Set<string>();
  const excluded = draft.excludedPublishers.flatMap((item) => {
    const publisher = publisherById.get(item.publisherId);

    if (!publisher || seen.has(item.publisherId) || recommendedIds.has(item.publisherId)) {
      if (!publisher) {
        warnings.add(`Dropped unknown excluded publisher id: ${item.publisherId}.`);
      }
      return [];
    }

    seen.add(item.publisherId);
    return [
      {
        publisher,
        score: clampScore(item.score),
        reason: item.reason || "Not a strong fit compared with recommended publishers.",
        signals: nonEmptySignals(item.signals, "Full-catalog model exclusion", item.score)
      }
    ];
  });

  fillFromBaseline(
    excluded,
    baseline.excludedPublishers.filter((item) => !recommendedIds.has(item.publisher.id)),
    (item) => item.publisher.id,
    3,
    8,
    warnings,
    "Added deterministic exclusion fallback to keep at least 3 exclusions."
  );

  return excluded.slice(0, 8);
}

function normalizeSelectedPersonas(
  draft: InlineCampaignDraft,
  baseline: CampaignResult,
  personaById: Map<string, Persona>,
  warnings: Set<string>
): ScoredPersona[] {
  const seen = new Set<string>();
  const selected = draft.selectedPersonas.flatMap((item) => {
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
        normalizedScore: clampScore(item.score) / 100,
        reasons: nonEmptyArray(item.reasons, "Model selected this persona from the full catalog."),
        risks: item.risks,
        messagingAngles: item.messagingAngles,
        signals: nonEmptySignals(item.signals, "Full-catalog persona fit", item.score)
      }
    ];
  });

  fillFromBaseline(
    selected,
    baseline.selectedPersonas,
    (item) => item.persona.id,
    3,
    5,
    warnings,
    "Added deterministic persona fallback to keep at least 3 personas."
  );

  return selected.slice(0, 5);
}

function normalizeCreativeVariants(
  variants: CreativeVariant[],
  baseline: CampaignResult,
  advertiserAnalysis: AdvertiserAnalysis,
  selectedPersonas: ScoredPersona[],
  selectedPersonaIds: Set<string>,
  warnings: Set<string>
) {
  const personaNameById = new Map(selectedPersonas.map((item) => [item.persona.id, item.persona.name]));
  const normalized = variants
    .filter((variant) => selectedPersonaIds.has(variant.personaId))
    .filter((variant) => variant.headline.trim() && variant.body.trim())
    .map((variant, index) => ({
      ...variant,
      id: variant.id || `creative_${String(index + 1).padStart(2, "0")}`,
      personaName: personaNameById.get(variant.personaId) ?? variant.personaName,
      headline: variant.headline.slice(0, 80),
      body: variant.body.slice(0, 220)
    }));

  if (normalized.length < 3) {
    warnings.add("Added fallback creative to keep 3 to 5 usable variants.");
    const fallbackVariants = generateFallbackCreative(advertiserAnalysis, selectedPersonas);
    fillFromBaseline(normalized, fallbackVariants, (item) => item.personaId, 3, 5, warnings);
  }

  fillFromBaseline(normalized, baseline.creativeVariants, (item) => item.personaId, 3, 5, warnings);

  return normalized.slice(0, 5);
}

function normalizeCampaignConfig(
  config: CampaignConfig,
  baseline: CampaignResult,
  recommendedPublishers: ScoredPublisher[],
  warnings: Set<string>
): CampaignConfig {
  const totalUsd = positiveNumber(config.budget.totalUsd) || baseline.campaignConfig.budget.totalUsd;
  const allocation = normalizeAllocation(config.budget.allocation, baseline, recommendedPublishers, warnings);
  const placementByPublisher = new Map(config.placements.map((placement) => [placement.publisherId, placement]));
  const placements = recommendedPublishers.map((item, index) => {
    const placement = placementByPublisher.get(item.publisher.id);

    return {
      publisherId: item.publisher.id,
      publisherName: item.publisher.name,
      placementType:
        placement?.placementType ||
        baseline.campaignConfig.placements.find((candidate) => candidate.publisherId === item.publisher.id)
          ?.placementType ||
        "native checkout recommendation",
      priority: placement?.priority || (index < 3 ? "primary" : "test")
    };
  });

  return {
    objective: config.objective || baseline.campaignConfig.objective,
    budget: {
      totalUsd,
      dailyUsd: positiveNumber(config.budget.dailyUsd) || Math.round(totalUsd / 30),
      allocation
    },
    targeting: {
      categories: nonEmptyArray(config.targeting.categories, baseline.campaignConfig.targeting.categories[0]),
      audienceAttributes: nonEmptyArray(
        config.targeting.audienceAttributes,
        baseline.campaignConfig.targeting.audienceAttributes[0]
      ),
      geos: nonEmptyArray(config.targeting.geos, baseline.campaignConfig.targeting.geos[0] ?? "nationwide"),
      excludedAttributes: config.targeting.excludedAttributes
    },
    placements,
    bidStrategy: {
      type: config.bidStrategy.type || baseline.campaignConfig.bidStrategy.type,
      rationale: config.bidStrategy.rationale || baseline.campaignConfig.bidStrategy.rationale
    },
    measurement: {
      primaryKpi: config.measurement.primaryKpi || baseline.campaignConfig.measurement.primaryKpi,
      secondaryKpis: nonEmptyArray(
        config.measurement.secondaryKpis,
        baseline.campaignConfig.measurement.secondaryKpis[0] ?? "conversion rate"
      )
    }
  };
}

function normalizeAllocation(
  allocations: PublisherBudgetAllocation[],
  baseline: CampaignResult,
  recommendedPublishers: ScoredPublisher[],
  warnings: Set<string>
): PublisherBudgetAllocation[] {
  const allocationByPublisher = new Map(allocations.map((item) => [item.publisherId, item]));
  const baselineByPublisher = new Map(
    baseline.campaignConfig.budget.allocation.map((item) => [item.publisherId, item])
  );
  const raw = recommendedPublishers.map((item) => {
    const allocation = allocationByPublisher.get(item.publisher.id);
    const baselineAllocation = baselineByPublisher.get(item.publisher.id);

    return {
      publisherId: item.publisher.id,
      publisherName: item.publisher.name,
      budgetPercent: positiveNumber(allocation?.budgetPercent) || baselineAllocation?.budgetPercent || item.score,
      bidCpmUsd: positiveNumber(allocation?.bidCpmUsd) || baselineAllocation?.bidCpmUsd || defaultBidCpm(item),
      rationale:
        allocation?.rationale ||
        baselineAllocation?.rationale ||
        `${item.publisher.name} receives budget because it ranked in the top full-catalog recommendations.`
    };
  });
  const sourceTotal = raw.reduce((total, item) => total + item.budgetPercent, 0);
  const normalizedSource =
    sourceTotal > 0
      ? raw.map((item) => ({ ...item, budgetPercent: item.budgetPercent / sourceTotal }))
      : raw.map((item) => ({ ...item, budgetPercent: Math.max(item.publisherId ? 1 : 0, 1) }));
  const weightTotal = normalizedSource.reduce((total, item) => total + item.budgetPercent, 0);
  const normalized = normalizedSource.map((item) => ({
    ...item,
    budgetPercent: Math.round((item.budgetPercent / weightTotal) * 100)
  }));
  const delta = 100 - normalized.reduce((total, item) => total + item.budgetPercent, 0);

  if (normalized[0]) {
    normalized[0] = {
      ...normalized[0],
      budgetPercent: normalized[0].budgetPercent + delta
    };
  }

  if (sourceTotal !== 100) {
    warnings.add("Normalized budget allocation to sum to 100.");
  }

  return normalized;
}

function fillFromBaseline<T>(
  target: T[],
  source: T[],
  getId: (item: T) => string,
  min: number,
  max: number,
  warnings: Set<string>,
  warning?: string
) {
  const seen = new Set(target.map(getId));
  let addedFallback = false;

  for (const item of source) {
    if (target.length >= min || target.length >= max) {
      break;
    }

    const id = getId(item);
    if (!seen.has(id) && target.length < max) {
      target.push(item);
      seen.add(id);
      addedFallback = true;
    }
  }

  if ((addedFallback || target.length < min) && warning) {
    warnings.add(warning);
  }
}

function nonEmptyArray(values: string[], fallback: string) {
  const cleanValues = values.map((value) => value.trim()).filter(Boolean);
  return cleanValues.length > 0 ? Array.from(new Set(cleanValues)) : [fallback];
}

function nonEmptySignals(signals: ScoreSignal[], label: string, score: number) {
  return signals.length > 0
    ? signals
    : [
        {
          label,
          detail: "Model-generated fit score from full catalog review.",
          weight: clampScore(score)
        }
      ];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function defaultBidCpm(item: ScoredPublisher) {
  return Number((8 + item.normalizedScore * 18).toFixed(2));
}
