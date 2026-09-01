import type {
  AdvertiserAnalysis,
  CampaignConfig,
  CampaignResult,
  CampaignStageTrace,
  CreativeVariant,
  ExcludedPublisher,
  ScoredPersona,
  ScoredPublisher
} from "../types";

export type AdvertiserProfile = AdvertiserAnalysis;

export type CampaignCandidates = {
  advertiserProfile: AdvertiserProfile;
  publisherCandidates: ScoredPublisher[];
  personaCandidates: ScoredPersona[];
  exclusionCandidates: ExcludedPublisher[];
  warnings: string[];
};

export type LockedCampaignStrategy = Pick<
  CampaignResult,
  "advertiserAnalysis" | "recommendedPublishers" | "excludedPublishers" | "selectedPersonas" | "warnings"
>;

export type LockedPublisherStrategy = Pick<
  CampaignResult,
  "advertiserAnalysis" | "recommendedPublishers" | "excludedPublishers" | "warnings"
>;

export type CampaignExecution = {
  creativeVariants: CreativeVariant[];
  campaignConfig: CampaignConfig;
  warnings: string[];
};

export type PipelineStageResult<T> = {
  data: T;
  trace: CampaignStageTrace;
};
