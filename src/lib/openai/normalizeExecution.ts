import { generateFallbackCreative } from "../creativeGenerator";
import type {
  AdvertiserAnalysis,
  CampaignConfig,
  CampaignResult,
  CreativeVariant,
  PublisherBudgetAllocation,
  ScoredPublisher
} from "../types";
import type { ExecutionResponse } from "../validation/campaignSchemas";
import { fillUniqueFromFallback, nonEmptyArray, positiveNumber } from "./normalizationUtils";
import type { NormalizedStrategy } from "./normalizeStrategy";

export function normalizeExecution({
  baseline,
  strategy,
  execution
}: {
  baseline: CampaignResult;
  strategy: NormalizedStrategy;
  execution: ExecutionResponse;
}): CampaignResult {
  const warnings = new Set([...strategy.warnings, ...execution.warnings]);
  const selectedPersonaIds = new Set(strategy.selectedPersonas.map((item) => item.persona.id));
  const creativeVariants = normalizeCreativeVariants(
    execution.creativeVariants,
    baseline,
    strategy.advertiserAnalysis,
    strategy,
    selectedPersonaIds,
    warnings
  );

  return {
    mode: "openai_staged",
    generatedAt: baseline.generatedAt,
    advertiserAnalysis: strategy.advertiserAnalysis,
    recommendedPublishers: strategy.recommendedPublishers,
    excludedPublishers: strategy.excludedPublishers,
    selectedPersonas: strategy.selectedPersonas,
    creativeVariants,
    campaignConfig: normalizeCampaignConfig(execution.campaignConfig, baseline, strategy.recommendedPublishers, warnings),
    warnings: Array.from(warnings)
  };
}

function normalizeCreativeVariants(
  variants: CreativeVariant[],
  baseline: CampaignResult,
  advertiserAnalysis: AdvertiserAnalysis,
  strategy: NormalizedStrategy,
  selectedPersonaIds: Set<string>,
  warnings: Set<string>
) {
  const personaNameById = new Map(strategy.selectedPersonas.map((item) => [item.persona.id, item.persona.name]));
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
    const fallbackVariants = generateFallbackCreative(advertiserAnalysis, strategy.selectedPersonas);
    fillUniqueFromFallback({
      target: normalized,
      fallback: fallbackVariants,
      getId: (item) => item.personaId,
      min: 3,
      max: 5,
      warnings,
      warning: "Added fallback creative to keep 3 to 5 usable variants."
    });
  }

  fillUniqueFromFallback({
    target: normalized,
    fallback: baseline.creativeVariants,
    getId: (item) => item.personaId,
    min: 3,
    max: 5,
    warnings,
    warning: "Added deterministic creative fallback to keep at least 3 variants."
  });

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
        `${item.publisher.name} receives budget because it ranked in the staged strategy output.`
    };
  });
  const sourceTotal = raw.reduce((total, item) => total + item.budgetPercent, 0);
  const normalized = raw.map((item) => ({
    ...item,
    budgetPercent: Math.round((item.budgetPercent / Math.max(sourceTotal, 1)) * 100)
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

function defaultBidCpm(item: ScoredPublisher) {
  return Number((8 + item.normalizedScore * 18).toFixed(2));
}
