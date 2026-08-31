import type {
  AdvertiserAnalysis,
  CampaignConfig,
  PublisherBudgetAllocation,
  ScoredPersona,
  ScoredPublisher
} from "./types";

export function buildCampaignConfig(
  analysis: AdvertiserAnalysis,
  recommendedPublishers: ScoredPublisher[],
  selectedPersonas: ScoredPersona[]
): CampaignConfig {
  const totalUsd = totalBudgetFor(analysis);
  const allocation = allocateBudget(analysis, recommendedPublishers);

  return {
    objective: analysis.likelyObjective,
    budget: {
      totalUsd,
      dailyUsd: Math.round(totalUsd / 30),
      allocation
    },
    targeting: {
      categories: Array.from(new Set([analysis.category, ...analysis.secondaryCategories])).filter(
        (category) => category !== "unknown"
      ),
      audienceAttributes: Array.from(
        new Set([
          ...analysis.audienceHints,
          ...selectedPersonas.map((item) => item.persona.name),
          ...analysis.productSignals
        ])
      ).slice(0, 10),
      geos: Array.from(
        new Set(recommendedPublishers.flatMap((item) => item.publisher.audience.top_geos))
      ).slice(0, 5),
      excludedAttributes: excludedAttributesFor(analysis, selectedPersonas)
    },
    placements: recommendedPublishers.map((item, index) => ({
      publisherId: item.publisher.id,
      publisherName: item.publisher.name,
      placementType: index < 2 ? "native checkout recommendation" : "audience extension test",
      priority: index < 3 ? "primary" : "test"
    })),
    bidStrategy: {
      type: bidStrategyFor(analysis),
      rationale: bidRationaleFor(analysis)
    },
    measurement: {
      primaryKpi: primaryKpiFor(analysis),
      secondaryKpis: ["click-through rate", "conversion rate", "cost per acquisition", "publisher-level ROAS"]
    }
  };
}

function allocateBudget(
  analysis: AdvertiserAnalysis,
  recommendedPublishers: ScoredPublisher[]
): PublisherBudgetAllocation[] {
  if (recommendedPublishers.length === 0) {
    return [];
  }

  const totalScore = recommendedPublishers.reduce((total, item) => total + Math.max(item.score, 1), 0);
  const rawAllocations = recommendedPublishers.map((item) => {
    const budgetPercent = Math.round((Math.max(item.score, 1) / totalScore) * 100);
    return {
      publisherId: item.publisher.id,
      publisherName: item.publisher.name,
      budgetPercent,
      bidCpmUsd: suggestedCpm(analysis, item),
      rationale: `${item.publisher.name} receives ${budgetPercent}% because it scored ${item.score}/100 on fit.`
    };
  });

  const delta = 100 - rawAllocations.reduce((total, item) => total + item.budgetPercent, 0);
  rawAllocations[0] = {
    ...rawAllocations[0],
    budgetPercent: rawAllocations[0].budgetPercent + delta
  };

  return rawAllocations;
}

function totalBudgetFor(analysis: AdvertiserAnalysis) {
  switch (analysis.priceTier) {
    case "budget":
      return 5000;
    case "value":
      return 7500;
    case "premium":
      return 15000;
    case "luxury":
      return 25000;
    case "unknown":
      return 6000;
    default:
      return 10000;
  }
}

function bidStrategyFor(analysis: AdvertiserAnalysis): CampaignConfig["bidStrategy"]["type"] {
  if (analysis.priceTier === "luxury" || analysis.priceTier === "premium") {
    return "premium_focus";
  }

  if (analysis.priceTier === "budget" || analysis.priceTier === "value") {
    return "efficient_reach";
  }

  return "balanced_cpm";
}

function bidRationaleFor(analysis: AdvertiserAnalysis) {
  if (analysis.priceTier === "luxury") {
    return "Prioritize high-income, high-AOV publishers where fewer but better-qualified impressions matter.";
  }

  if (analysis.priceTier === "value") {
    return "Start with efficient reach, then shift spend toward publishers with the strongest early conversion signal.";
  }

  return "Balance reach and fit across the best-matched publishers while collecting enough signal for optimization.";
}

function primaryKpiFor(analysis: AdvertiserAnalysis) {
  if (analysis.purchaseModel === "subscription") {
    return "new subscriptions";
  }

  if (analysis.likelyObjective === "qualified lead generation") {
    return "qualified demo requests";
  }

  return "new customer purchases";
}

function suggestedCpm(analysis: AdvertiserAnalysis, publisher: ScoredPublisher) {
  const priceMultiplier = analysis.priceTier === "luxury" ? 1.4 : analysis.priceTier === "premium" ? 1.2 : 1;
  const fitMultiplier = 1 + publisher.normalizedScore * 0.5;
  const aovBase = Math.max(8, Math.min(28, publisher.publisher.avg_order_value_usd / 7));
  return Number((aovBase * priceMultiplier * fitMultiplier).toFixed(2));
}

function excludedAttributesFor(analysis: AdvertiserAnalysis, selectedPersonas: ScoredPersona[]) {
  const personaDisinterests = selectedPersonas.flatMap((item) => item.persona.disinterested_in);
  const exclusions = new Set<string>();

  if (analysis.priceTier === "luxury" || analysis.priceTier === "premium") {
    exclusions.add("ultra-discount seekers");
  }

  if (analysis.ambiguityLevel === "high") {
    exclusions.add("narrow retargeting until positioning is clarified");
  }

  personaDisinterests.slice(0, 4).forEach((item) => exclusions.add(item));

  return Array.from(exclusions).slice(0, 6);
}
