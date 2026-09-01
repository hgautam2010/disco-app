import { getPersonas, getPublishers } from "../data";
import { strategyResponseJsonSchema } from "../schemas";
import { strategyResponseSchema, type StrategyResponse } from "../validation/campaignSchemas";
import { createStructuredResponse, getOpenAIModel } from "./client";
import { buildStrategyPrompt } from "./prompts";

export async function generateStrategy(advertiserDescription: string): Promise<StrategyResponse> {
  const draft = await createStructuredResponse<unknown>({
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
          publishers: getPublishers(),
          personas: getPersonas()
        })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...strategyResponseJsonSchema
      }
    }
  });

  return strategyResponseSchema.parse(draft);
}
