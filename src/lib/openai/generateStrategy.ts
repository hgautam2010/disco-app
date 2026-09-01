import { getPersonas, getPublishers } from "../data";
import { strategyResponseJsonSchema } from "../schemas";
import { strategyResponseSchema, type StrategyResponse } from "../validation/campaignSchemas";
import { getOpenAIModel } from "./client";
import { buildStrategyPrompt } from "./prompts";
import { generateAndValidateWithRepair, type RepairableStructuredRequest } from "./repairResponse";

export async function generateStrategy(advertiserDescription: string): Promise<StrategyResponse> {
  const publishers = getPublishers();
  const personas = getPersonas();
  const request: RepairableStructuredRequest = {
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: buildStrategyPrompt()
      },
      {
        role: "user",
        content: JSON.stringify({
          advertiserDescription,
          publishers,
          personas
        })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...strategyResponseJsonSchema
      }
    }
  };

  return generateAndValidateWithRepair({
    label: "strategy",
    schema: strategyResponseSchema,
    request,
    fallbackCandidates: {
      publishers,
      personas
    }
  });
}
