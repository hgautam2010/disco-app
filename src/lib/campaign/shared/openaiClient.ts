import type { CampaignStageRequestConfig, TokenUsage } from "../../types";
import { emptyTokenUsage } from "./tokenUsage";

export type ResponsesApiBody = {
  model: string;
  input: {
    role: "system" | "user";
    content: string;
  }[];
  text: {
    format: Record<string, unknown>;
  };
  reasoning?: {
    effort: OpenAIReasoningEffort;
  };
  max_output_tokens?: number;
  service_tier?: OpenAIServiceTier;
};

type ResponsesApiResult = {
  model?: string;
  service_tier?: string | null;
  output_text?: string;
  output?: {
    content?: {
      type?: string;
      text?: string;
    }[];
  }[];
  usage?: ResponsesApiUsage | null;
};

type ResponsesApiUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
};

export type StructuredResponse<T> = {
  data: T;
  model: string;
  usage: TokenUsage;
  serviceTier?: string;
};

export type OpenAIModelStage = "extract" | "rank_publishers" | "select_personas" | "execute" | "repair";

export type OpenAIReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export type OpenAIServiceTier = "auto" | "default" | "flex" | "fast" | "priority" | "ultrafast";

export type OpenAIRequestConfig = {
  reasoningEffort: OpenAIReasoningEffort;
  maxOutputTokens: number;
  serviceTier?: OpenAIServiceTier;
};

const responsesEndpoint = "https://api.openai.com/v1/responses";
const defaultOpenAIModel = "gpt-5.4-mini";

const stageModelEnvVars: Record<OpenAIModelStage, string> = {
  extract: "OPENAI_EXTRACT_MODEL",
  rank_publishers: "OPENAI_RANK_PUBLISHERS_MODEL",
  select_personas: "OPENAI_SELECT_PERSONAS_MODEL",
  execute: "OPENAI_EXECUTION_MODEL",
  repair: "OPENAI_REPAIR_MODEL"
};

const defaultModelByStage: Partial<Record<OpenAIModelStage, string>> = {
  extract: "gpt-5.4-nano",
  repair: "gpt-5.4-nano"
};

const stageReasoningEnvVars: Record<OpenAIModelStage, string> = {
  extract: "OPENAI_EXTRACT_REASONING_EFFORT",
  rank_publishers: "OPENAI_RANK_PUBLISHERS_REASONING_EFFORT",
  select_personas: "OPENAI_SELECT_PERSONAS_REASONING_EFFORT",
  execute: "OPENAI_EXECUTION_REASONING_EFFORT",
  repair: "OPENAI_REPAIR_REASONING_EFFORT"
};

const stageMaxOutputTokenEnvVars: Record<OpenAIModelStage, string> = {
  extract: "OPENAI_EXTRACT_MAX_OUTPUT_TOKENS",
  rank_publishers: "OPENAI_RANK_PUBLISHERS_MAX_OUTPUT_TOKENS",
  select_personas: "OPENAI_SELECT_PERSONAS_MAX_OUTPUT_TOKENS",
  execute: "OPENAI_EXECUTION_MAX_OUTPUT_TOKENS",
  repair: "OPENAI_REPAIR_MAX_OUTPUT_TOKENS"
};

const defaultReasoningEffortByStage: Record<OpenAIModelStage, OpenAIReasoningEffort> = {
  extract: "none",
  rank_publishers: "none",
  select_personas: "none",
  execute: "none",
  repair: "none"
};

const defaultMaxOutputTokensByStage: Record<OpenAIModelStage, number> = {
  extract: 800,
  rank_publishers: 2000,
  select_personas: 2200,
  execute: 3000,
  repair: 1800
};

const allowedReasoningEfforts: OpenAIReasoningEffort[] = ["none", "low", "medium", "high", "xhigh", "max"];
const allowedServiceTiers: OpenAIServiceTier[] = ["auto", "default", "flex", "fast", "priority", "ultrafast"];

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIModel() {
  return readEnv("OPENAI_MODEL") ?? defaultOpenAIModel;
}

export function getOpenAIModelForStage(stage: OpenAIModelStage) {
  return readEnv(stageModelEnvVars[stage]) ?? readEnv("OPENAI_MODEL") ?? defaultModelByStage[stage] ?? getOpenAIModel();
}

export function getOpenAIRequestConfigForStage(stage: OpenAIModelStage): OpenAIRequestConfig {
  return {
    reasoningEffort:
      readEnumEnv(stageReasoningEnvVars[stage], allowedReasoningEfforts) ??
      readEnumEnv("OPENAI_REASONING_EFFORT", allowedReasoningEfforts) ??
      defaultReasoningEffortByStage[stage],
    maxOutputTokens:
      readPositiveIntegerEnv(stageMaxOutputTokenEnvVars[stage]) ??
      readPositiveIntegerEnv("OPENAI_MAX_OUTPUT_TOKENS") ??
      defaultMaxOutputTokensByStage[stage],
    serviceTier: readEnumEnv("OPENAI_SERVICE_TIER", allowedServiceTiers)
  };
}

export function toResponsesRequestConfig(config: OpenAIRequestConfig) {
  return {
    reasoning: {
      effort: config.reasoningEffort
    },
    max_output_tokens: config.maxOutputTokens,
    ...(config.serviceTier ? { service_tier: config.serviceTier } : {})
  } satisfies Pick<ResponsesApiBody, "reasoning" | "max_output_tokens" | "service_tier">;
}

export function toTraceRequestConfig(
  config: OpenAIRequestConfig,
  actualServiceTier?: string
): CampaignStageRequestConfig {
  return {
    reasoningEffort: config.reasoningEffort,
    maxOutputTokens: config.maxOutputTokens,
    serviceTier: config.serviceTier ?? "auto",
    actualServiceTier
  };
}

export async function createStructuredResponse<T>(body: ResponsesApiBody): Promise<StructuredResponse<T>> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch(responsesEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI request failed with ${response.status}: ${errorBody}`);
  }

  const json = (await response.json()) as ResponsesApiResult;
  const outputText = extractOutputText(json);

  if (!outputText) {
    throw new Error("OpenAI response did not include output text.");
  }

  return {
    data: JSON.parse(outputText) as T,
    model: json.model ?? body.model,
    usage: normalizeUsage(json.usage),
    serviceTier: json.service_tier ?? undefined
  };
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readEnumEnv<T extends string>(name: string, allowedValues: T[]) {
  const value = readEnv(name);

  if (!value) {
    return undefined;
  }

  return allowedValues.includes(value as T) ? (value as T) : undefined;
}

function readPositiveIntegerEnv(name: string) {
  const value = readEnv(name);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function extractOutputText(result: ResponsesApiResult) {
  if (typeof result.output_text === "string") {
    return result.output_text;
  }

  return (
    result.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text" && typeof content.text === "string")?.text ?? ""
  );
}

function normalizeUsage(usage: ResponsesApiUsage | null | undefined): TokenUsage {
  if (!usage) {
    return emptyTokenUsage();
  }

  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? 0,
    reasoningOutputTokens: usage.output_tokens_details?.reasoning_tokens ?? 0
  };
}
