import { z } from "zod";

const stringArrayJsonSchema = {
  type: "array",
  items: { type: "string" }
};

const scoreSignalSchema = z.object({
  label: z.string().min(1),
  detail: z.string().min(1),
  weight: z.number()
});

const scoreSignalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "detail", "weight"],
  properties: {
    label: { type: "string" },
    detail: { type: "string" },
    weight: { type: "number" }
  }
};

const strategyPersonaSchema = z.object({
  personaId: z.string().min(1),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string().min(1)).min(1),
  risks: z.array(z.string()),
  messagingAngles: z.array(z.string()),
  signals: z.array(scoreSignalSchema)
});

const selectedPersonasJsonSchema = {
  type: "array",
  minItems: 3,
  maxItems: 5,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["personaId", "score", "reasons", "risks", "messagingAngles", "signals"],
    properties: {
      personaId: { type: "string" },
      score: { type: "number", minimum: 0, maximum: 100 },
      reasons: stringArrayJsonSchema,
      risks: stringArrayJsonSchema,
      messagingAngles: stringArrayJsonSchema,
      signals: {
        type: "array",
        items: scoreSignalJsonSchema
      }
    }
  }
};

export const personaSelectionResponseSchema = z.object({
  selectedPersonas: z.array(strategyPersonaSchema).min(3).max(5),
  warnings: z.array(z.string())
});

export const personaSelectionResponseJsonSchema = {
  name: "persona_selection_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["selectedPersonas", "warnings"],
    properties: {
      selectedPersonas: selectedPersonasJsonSchema,
      warnings: stringArrayJsonSchema
    }
  }
};

export type PersonaSelectionResponse = z.infer<typeof personaSelectionResponseSchema>;
