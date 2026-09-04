import type {
  AdvertiserAnalysis,
  CampaignConfig,
  CampaignResult,
  CampaignStageTrace,
  CreativeVariant,
  Persona,
  Publisher
} from "../types";

export type AdvertiserProfile = AdvertiserAnalysis;

export type CampaignCatalogue = {
  advertiserProfile: AdvertiserProfile;
  publishers: Publisher[];
  personas: Persona[];
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
