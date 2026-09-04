import type { ZodType } from "zod";
import { createStructuredResponse, type ResponsesApiBody, type StructuredResponse } from "./openaiClient";
import { repairStructuredResponse } from "./repairResponse";
import { addTokenUsage, emptyTokenUsage } from "./tokenUsage";
import type { TokenUsage } from "../../types";

export type RepairableStructuredRequest = ResponsesApiBody;

type GenerateAndValidateOptions<T> = {
  label: string;
  schema: ZodType<T>;
  request: RepairableStructuredRequest;
  repairContext: unknown;
};

export type StructuredGenerationResult<T> = {
  data: T;
  apiCalls: number;
  attempts: number;
  model: string;
  serviceTier?: string;
  tokenUsage: TokenUsage;
  repaired: boolean;
};

export class StructuredGenerationError extends Error {
  apiCalls: number;
  attempts: number;
  model: string;
  tokenUsage: TokenUsage;
  repaired: boolean;

  constructor(
    message: string,
    {
      apiCalls,
      attempts,
      model,
      tokenUsage,
      repaired
    }: { apiCalls: number; attempts: number; model: string; tokenUsage: TokenUsage; repaired: boolean }
  ) {
    super(message);
    this.name = "StructuredGenerationError";
    this.apiCalls = apiCalls;
    this.attempts = attempts;
    this.model = model;
    this.tokenUsage = tokenUsage;
    this.repaired = repaired;
  }
}

export async function generateAndValidateWithRepair<T>({
  label,
  schema,
  request,
  repairContext
}: GenerateAndValidateOptions<T>) {
  return (
    await generateAndValidateWithRepairResult({
      label,
      schema,
      request,
      repairContext
    })
  ).data;
}

export async function generateAndValidateWithRepairResult<T>({
  label,
  schema,
  request,
  repairContext
}: GenerateAndValidateOptions<T>): Promise<StructuredGenerationResult<T>> {
  let original: StructuredResponse<unknown>;

  try {
    original = await createStructuredResponse<unknown>(request);
  } catch (error) {
    throw new StructuredGenerationError(errorMessage(error), {
      apiCalls: 1,
      attempts: 1,
      model: request.model,
      tokenUsage: emptyTokenUsage(),
      repaired: false
    });
  }

  const parsed = schema.safeParse(original.data);

  if (parsed.success) {
    return {
      data: parsed.data,
      apiCalls: 1,
      attempts: 1,
      model: original.model,
      serviceTier: original.serviceTier,
      tokenUsage: original.usage,
      repaired: false
    };
  }

  let repairUsage = emptyTokenUsage();

  try {
    const repaired = await repairStructuredResponse({
      label,
      schema: request.text.format,
      original: original.data,
      validationError: parsed.error,
      repairContext
    });
    repairUsage = repaired.usage;

    return {
      data: schema.parse(repaired.data),
      apiCalls: 2,
      attempts: 2,
      model: original.model,
      serviceTier: original.serviceTier,
      tokenUsage: addTokenUsage(original.usage, repairUsage),
      repaired: true
    };
  } catch (error) {
    throw new StructuredGenerationError(errorMessage(error), {
      apiCalls: 2,
      attempts: 2,
      model: original.model,
      tokenUsage: addTokenUsage(original.usage, repairUsage),
      repaired: true
    });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Structured generation failed.";
}
