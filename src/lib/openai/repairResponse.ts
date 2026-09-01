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

export type StructuredGenerationResult<T> = {
  data: T;
  apiCalls: number;
  repaired: boolean;
};

export class StructuredGenerationError extends Error {
  apiCalls: number;
  repaired: boolean;

  constructor(message: string, { apiCalls, repaired }: { apiCalls: number; repaired: boolean }) {
    super(message);
    this.name = "StructuredGenerationError";
    this.apiCalls = apiCalls;
    this.repaired = repaired;
  }
}

export async function generateAndValidateWithRepair<T>({
  label,
  schema,
  request,
  fallbackCandidates
}: GenerateAndValidateOptions<T>) {
  return (
    await generateAndValidateWithRepairResult({
      label,
      schema,
      request,
      fallbackCandidates
    })
  ).data;
}

export async function generateAndValidateWithRepairResult<T>({
  label,
  schema,
  request,
  fallbackCandidates
}: GenerateAndValidateOptions<T>): Promise<StructuredGenerationResult<T>> {
  let original: unknown;

  try {
    original = await createStructuredResponse<unknown>(request);
  } catch (error) {
    throw new StructuredGenerationError(errorMessage(error), { apiCalls: 1, repaired: false });
  }

  const parsed = schema.safeParse(original);

  if (parsed.success) {
    return {
      data: parsed.data,
      apiCalls: 1,
      repaired: false
    };
  }

  try {
    const repaired = await repairResponse({
      label,
      schema: request.text.format,
      original,
      validationError: parsed.error,
      fallbackCandidates
    });

    return {
      data: schema.parse(repaired),
      apiCalls: 2,
      repaired: true
    };
  } catch (error) {
    throw new StructuredGenerationError(errorMessage(error), { apiCalls: 2, repaired: true });
  }
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Structured generation failed.";
}
