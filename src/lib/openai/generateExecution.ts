import { getPersonas, getPublishers } from "../data";
import { executionResponseJsonSchema } from "../schemas";
import { executionResponseSchema, type ExecutionResponse, type StrategyResponse } from "../validation/campaignSchemas";
import { getOpenAIModel } from "./client";
import { buildExecutionPrompt } from "./prompts";
import { generateAndValidateWithRepair, type RepairableStructuredRequest } from "./repairResponse";

export async function generateExecution(
  advertiserDescription: string,
  strategy: StrategyResponse
): Promise<ExecutionResponse> {
  const publishers = getPublishers();
  const personas = getPersonas();
  const recommendedPublisherIds = new Set(strategy.recommendedPublishers.map((item) => item.publisherId));
  const excludedPublisherIds = new Set(strategy.excludedPublishers.map((item) => item.publisherId));
  const selectedPersonaIds = new Set(strategy.selectedPersonas.map((item) => item.personaId));
  const recommendedPublishers = publishers.filter((publisher) => recommendedPublisherIds.has(publisher.id));
  const excludedPublishers = publishers.filter((publisher) => excludedPublisherIds.has(publisher.id));
  const selectedPersonas = personas.filter((persona) => selectedPersonaIds.has(persona.id));
  const request: RepairableStructuredRequest = {
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
          recommendedPublishers,
          excludedPublishers,
          selectedPersonas
        })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...executionResponseJsonSchema
      }
    }
  };

  return generateAndValidateWithRepair({
    label: "execution",
    schema: executionResponseSchema,
    request,
    fallbackCandidates: {
      strategy,
      recommendedPublishers,
      excludedPublishers,
      selectedPersonas
    }
  });
}
