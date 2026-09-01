import { assembleFinalCampaign } from "../campaign/stages/assemble/run";
import { extractAdvertiserProfile } from "../campaign/stages/extract-advertiser/run";
import { generateExecutionStage } from "../campaign/stages/generate-execution/run";
import { rankPublisherStrategy } from "../campaign/stages/rank-publishers/run";
import { retrieveCampaignCandidates } from "../campaign/stages/retrieve-candidates/run";
import { selectPersonaStrategy } from "../campaign/stages/select-personas/run";

export async function generateStagedOpenAICampaign(advertiserDescription: string) {
  const generatedAt = new Date().toISOString();
  const extraction = await extractAdvertiserProfile(advertiserDescription);
  const candidates = retrieveCampaignCandidates(extraction.data);
  const publisherStrategy = await rankPublisherStrategy(candidates.data);
  const strategy = await selectPersonaStrategy(candidates.data, publisherStrategy.data);
  const execution = await generateExecutionStage(advertiserDescription, strategy.data);

  return assembleFinalCampaign({
    generatedAt,
    strategy: strategy.data,
    execution: execution.data,
    stageTraces: [extraction.trace, candidates.trace, publisherStrategy.trace, strategy.trace, execution.trace]
  });
}
