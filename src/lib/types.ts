export type PriceTier = "budget" | "value" | "mid_market" | "premium" | "luxury" | "unknown";

export type AmbiguityLevel = "low" | "medium" | "high";

export type CampaignMode = "openai" | "openai_inline" | "fallback";

export type PublisherAudience = {
  age_skew: string;
  gender_split: {
    female: number;
    male: number;
    other: number;
  };
  top_geos: string[];
  income_tier: string;
};

export type Publisher = {
  id: string;
  name: string;
  category: string;
  subcategories: string[];
  monthly_impressions: number;
  avg_order_value_usd: number;
  audience: PublisherAudience;
  notes: string;
};

export type Persona = {
  id: string;
  name: string;
  age_range: string;
  gender_skew: string;
  description: string;
  category_affinities: string[];
  price_sensitivity: string;
  messaging_preferences: string[];
  disinterested_in: string[];
  typical_aov_usd: number;
};

export type AdvertiserAnalysis = {
  originalDescription: string;
  category: string;
  secondaryCategories: string[];
  priceTier: PriceTier;
  audienceHints: string[];
  productSignals: string[];
  valuePropositions: string[];
  purchaseModel: string;
  likelyObjective: string;
  ambiguityLevel: AmbiguityLevel;
  confidence: number;
};

export type ScoreSignal = {
  label: string;
  detail: string;
  weight: number;
};

export type ScoredPersona = {
  persona: Persona;
  score: number;
  normalizedScore: number;
  reasons: string[];
  risks: string[];
  messagingAngles: string[];
  signals: ScoreSignal[];
};

export type ScoredPublisher = {
  publisher: Publisher;
  score: number;
  normalizedScore: number;
  reasons: string[];
  risks: string[];
  signals: ScoreSignal[];
};

export type ExcludedPublisher = {
  publisher: Publisher;
  score: number;
  reason: string;
  signals: ScoreSignal[];
};

export type CreativeVariant = {
  id: string;
  personaId: string;
  personaName: string;
  headline: string;
  body: string;
  rationale: string;
  tone: string;
};

export type PublisherBudgetAllocation = {
  publisherId: string;
  publisherName: string;
  budgetPercent: number;
  bidCpmUsd: number;
  rationale: string;
};

export type CampaignConfig = {
  objective: string;
  budget: {
    totalUsd: number;
    dailyUsd: number;
    allocation: PublisherBudgetAllocation[];
  };
  targeting: {
    categories: string[];
    audienceAttributes: string[];
    geos: string[];
    excludedAttributes: string[];
  };
  placements: {
    publisherId: string;
    publisherName: string;
    placementType: string;
    priority: "primary" | "test";
  }[];
  bidStrategy: {
    type: "balanced_cpm" | "efficient_reach" | "premium_focus";
    rationale: string;
  };
  measurement: {
    primaryKpi: string;
    secondaryKpis: string[];
  };
};

export type CampaignResult = {
  mode: CampaignMode;
  generatedAt: string;
  advertiserAnalysis: AdvertiserAnalysis;
  recommendedPublishers: ScoredPublisher[];
  excludedPublishers: ExcludedPublisher[];
  selectedPersonas: ScoredPersona[];
  creativeVariants: CreativeVariant[];
  campaignConfig: CampaignConfig;
  warnings: string[];
};

export type ExampleAdvertiser = {
  id: string;
  description: string;
};
