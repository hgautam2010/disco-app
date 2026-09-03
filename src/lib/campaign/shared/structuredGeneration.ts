import type { ZodType } from "zod";
import { createStructuredResponse } from "./openaiClient";
import { repairStructuredResponse } from "./repairResponse";

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
  repairContext: unknown;
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
    const repaired = await repairStructuredResponse({
      label,
      schema: request.text.format,
      original,
      validationError: parsed.error,
      repairContext
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Structured generation failed.";
}
