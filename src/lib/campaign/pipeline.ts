import { assembleFinalCampaign } from "./stages/assemble/run";
import { extractAdvertiserProfile } from "./stages/extract-advertiser/run";
import { generateExecutionStage } from "./stages/generate-execution/run";
import { rankPublisherStrategy } from "./stages/rank-publishers/run";
import { loadCampaignCatalogue } from "./stages/retrieve-candidates/run";
import { selectPersonaStrategy } from "./stages/select-personas/run";

export async function generateStagedOpenAICampaign(advertiserDescription: string) {
  const generatedAt = new Date().toISOString();
  const extraction = await extractAdvertiserProfile(advertiserDescription);
  const catalogue = loadCampaignCatalogue(extraction.data);
  const publisherStrategy = await rankPublisherStrategy(catalogue.data);
  const strategy = await selectPersonaStrategy(catalogue.data, publisherStrategy.data);
  const execution = await generateExecutionStage(advertiserDescription, strategy.data);

  return assembleFinalCampaign({
    generatedAt,
    strategy: strategy.data,
    execution: execution.data,
    stageTraces: [extraction.trace, catalogue.trace, publisherStrategy.trace, strategy.trace, execution.trace]
  });
}
