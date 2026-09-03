import type { TokenUsage } from "../../types";
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
};

type ResponsesApiResult = {
  model?: string;
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
};

export type OpenAIModelStage = "extract" | "rank_publishers" | "select_personas" | "execute" | "repair";

const responsesEndpoint = "https://api.openai.com/v1/responses";
const defaultOpenAIModel = "gpt-5.1";

const stageModelEnvVars: Record<OpenAIModelStage, string> = {
  extract: "OPENAI_EXTRACT_MODEL",
  rank_publishers: "OPENAI_RANK_PUBLISHERS_MODEL",
  select_personas: "OPENAI_SELECT_PERSONAS_MODEL",
  execute: "OPENAI_EXECUTION_MODEL",
  repair: "OPENAI_REPAIR_MODEL"
};

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIModel() {
  return readEnv("OPENAI_MODEL") ?? defaultOpenAIModel;
}

export function getOpenAIModelForStage(stage: OpenAIModelStage) {
  return readEnv(stageModelEnvVars[stage]) ?? getOpenAIModel();
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
    usage: normalizeUsage(json.usage)
  };
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
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
