import { getPersonas, getPublishers } from "../data";
import { executionResponseJsonSchema } from "../schemas";
import { executionResponseSchema, type ExecutionResponse, type StrategyResponse } from "../validation/campaignSchemas";
import { createStructuredResponse, getOpenAIModel } from "./client";
import { buildExecutionPrompt } from "./prompts";

export async function generateExecution(
  advertiserDescription: string,
  strategy: StrategyResponse
): Promise<ExecutionResponse> {
  const publishers = getPublishers();
  const personas = getPersonas();
  const recommendedPublisherIds = new Set(strategy.recommendedPublishers.map((item) => item.publisherId));
  const excludedPublisherIds = new Set(strategy.excludedPublishers.map((item) => item.publisherId));
  const selectedPersonaIds = new Set(strategy.selectedPersonas.map((item) => item.personaId));
  const draft = await createStructuredResponse<unknown>({
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: buildExecutionPrompt()
      },
      {
        role: "user",
        content: JSON.stringify({
          advertiserDescription,
          strategy,
          recommendedPublishers: publishers.filter((publisher) => recommendedPublisherIds.has(publisher.id)),
          excludedPublishers: publishers.filter((publisher) => excludedPublisherIds.has(publisher.id)),
          selectedPersonas: personas.filter((persona) => selectedPersonaIds.has(persona.id))
        })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...executionResponseJsonSchema
      }
    }
  });

  return executionResponseSchema.parse(draft);
}
