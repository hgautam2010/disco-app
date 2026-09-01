import type { ZodError } from "zod";
import { getPersonas, getPublishers } from "../../data";
import { buildRepairPrompt } from "../../openai/prompts";
import { createStructuredResponse, getOpenAIModel } from "./openaiClient";

export async function repairStructuredResponse({
  label,
  schema,
  original,
  validationError,
  fallbackCandidates
}: {
  label: string;
  schema: Record<string, unknown>;
  original: unknown;
  validationError: ZodError;
  fallbackCandidates: unknown;
}) {
  return createStructuredResponse<unknown>({
    model: getOpenAIModel(),
    input: [
      {
        role: "system",
        content: buildRepairPrompt()
      },
      {
        role: "user",
        content: JSON.stringify({
          responseLabel: label,
          validationErrors: validationError.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          })),
          invalidResponse: original,
          allowedPublisherIds: getPublishers().map((publisher) => publisher.id),
          allowedPersonaIds: getPersonas().map((persona) => persona.id),
          fallbackCandidates,
          schema
        })
      }
    ],
    text: {
      format: schema
    }
  });
}
