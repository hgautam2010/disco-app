import type { CampaignConfig, CreativeVariant, PublisherBudgetAllocation, ScoredPublisher } from "../../../types";
import { positiveNumber } from "../../shared/normalization";
import type { CampaignExecution, LockedCampaignStrategy } from "../../types";
import type { ExecutionResponse } from "./schema";

export function normalizeExecution({
  strategy,
  execution
}: {
  strategy: LockedCampaignStrategy;
  execution: ExecutionResponse;
}): CampaignExecution {
  const warnings = new Set([...strategy.warnings, ...execution.warnings]);
  const selectedPersonaIds = new Set(strategy.selectedPersonas.map((item) => item.persona.id));
  const creativeVariants = normalizeCreativeVariants(execution.creativeVariants, strategy, selectedPersonaIds, warnings);

  return {
    creativeVariants,
    campaignConfig: normalizeCampaignConfig(execution.campaignConfig, strategy.recommendedPublishers, warnings),
    warnings: Array.from(warnings)
  };
}

function normalizeCreativeVariants(
  variants: CreativeVariant[],
  strategy: LockedCampaignStrategy,
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
    throw new Error("Execution response must include at least 3 creative variants for selected personas.");
  }

  return normalized.slice(0, 5);
}

function normalizeCampaignConfig(
  config: CampaignConfig,
  recommendedPublishers: ScoredPublisher[],
  warnings: Set<string>
): CampaignConfig {
  const totalUsd = positiveNumber(config.budget.totalUsd);
  const allocation = normalizeAllocation(config.budget.allocation, recommendedPublishers, warnings);
  const recommendedPublisherIds = new Set(recommendedPublishers.map((item) => item.publisher.id));
  const placements = config.placements.flatMap((placement, index) => {
    const recommendedPublisher = recommendedPublishers.find((item) => item.publisher.id === placement.publisherId);

    if (!recommendedPublisherIds.has(placement.publisherId) || !recommendedPublisher) {
      warnings.add(`Dropped placement outside recommended publisher set: ${placement.publisherId}.`);
      return [];
    }

    return [
      {
        publisherId: recommendedPublisher.publisher.id,
        publisherName: recommendedPublisher.publisher.name,
        placementType: placement.placementType,
        priority: placement.priority || (index < 3 ? "primary" : "test")
      }
    ];
  });

  if (!totalUsd) {
    throw new Error("Execution response must include a positive total budget.");
  }

  if (placements.length < 3) {
    throw new Error("Execution response must include at least 3 placements for recommended publishers.");
  }

  return {
    objective: config.objective,
    budget: {
      totalUsd,
      dailyUsd: positiveNumber(config.budget.dailyUsd) || Math.round(totalUsd / 30),
      allocation
    },
    targeting: {
      categories: config.targeting.categories,
      audienceAttributes: config.targeting.audienceAttributes,
      geos: config.targeting.geos,
      excludedAttributes: config.targeting.excludedAttributes
    },
    placements: placements.slice(0, 5),
    bidStrategy: {
      type: config.bidStrategy.type,
      rationale: config.bidStrategy.rationale
    },
    measurement: {
      primaryKpi: config.measurement.primaryKpi,
      secondaryKpis: config.measurement.secondaryKpis
    }
  };
}

function normalizeAllocation(
  allocations: PublisherBudgetAllocation[],
  recommendedPublishers: ScoredPublisher[],
  warnings: Set<string>
): PublisherBudgetAllocation[] {
  const recommendedById = new Map(recommendedPublishers.map((item) => [item.publisher.id, item]));
  const seen = new Set<string>();
  const raw = allocations.flatMap((allocation) => {
    const recommendedPublisher = recommendedById.get(allocation.publisherId);

    if (!recommendedPublisher || seen.has(allocation.publisherId)) {
      if (!recommendedPublisher) {
        warnings.add(`Dropped budget allocation outside recommended publisher set: ${allocation.publisherId}.`);
      }
      return [];
    }

    seen.add(allocation.publisherId);

    return [
      {
        publisherId: recommendedPublisher.publisher.id,
        publisherName: recommendedPublisher.publisher.name,
        budgetPercent: allocation.budgetPercent,
        bidCpmUsd: positiveNumber(allocation.bidCpmUsd) || defaultBidCpm(recommendedPublisher),
        rationale: allocation.rationale
      }
    ];
  });

  if (raw.length < 3) {
    throw new Error("Execution response must include at least 3 budget allocations for recommended publishers.");
  }

  const sourceTotal = raw.reduce((total, item) => total + item.budgetPercent, 0);
  if (sourceTotal <= 0) {
    throw new Error("Execution response budget allocation must be greater than zero.");
  }

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
