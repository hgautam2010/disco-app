import type { ZodError, ZodType } from "zod";
import { getPersonas, getPublishers } from "../data";
import { createStructuredResponse, getOpenAIModel } from "./client";
import { buildRepairPrompt } from "./prompts";

export type RepairableStructuredRequest = {
  model: string;
  input: {
    role: "system" | "user";
    content: string;
  }[];
  text: {
    format: Record<string, unknown>;
  };
};

type GenerateAndValidateOptions<T> = {
  label: string;
  schema: ZodType<T>;
  request: RepairableStructuredRequest;
  fallbackCandidates: unknown;
};

export async function generateAndValidateWithRepair<T>({
  label,
  schema,
  request,
  fallbackCandidates
}: GenerateAndValidateOptions<T>) {
  const original = await createStructuredResponse<unknown>(request);
  const parsed = schema.safeParse(original);

  if (parsed.success) {
    return parsed.data;
  }

  const repaired = await repairResponse({
    label,
    schema: request.text.format,
    original,
    validationError: parsed.error,
    fallbackCandidates
  });
  return schema.parse(repaired);
}

async function repairResponse({
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
