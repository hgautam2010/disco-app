import type { ZodError } from "zod";
import { getPersonas, getPublishers } from "../../data";
import { createStructuredResponse, getOpenAIModelForStage } from "./openaiClient";
import { readSharedPrompt } from "./prompts";

export async function repairStructuredResponse({
  label,
  schema,
  original,
  validationError,
  repairContext
}: {
  label: string;
  schema: Record<string, unknown>;
  original: unknown;
  validationError: ZodError;
  repairContext: unknown;
}) {
  return createStructuredResponse<unknown>({
    model: getOpenAIModelForStage("repair"),
    input: [
      {
        role: "system",
        content: readSharedPrompt("repair-response.md")
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
          repairContext,
          schema
        })
      }
    ],
    text: {
      format: schema
    }
  });
}
