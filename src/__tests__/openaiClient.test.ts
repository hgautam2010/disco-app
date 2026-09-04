import { describe, expect, it } from "vitest";
import {
  getOpenAIModel,
  getOpenAIModelForStage,
  getOpenAIRequestConfigForStage,
  toResponsesRequestConfig,
  type OpenAIModelStage
} from "@/lib/campaign/shared/openaiClient";

const openAIEnvNames = [
  "OPENAI_MODEL",
  "OPENAI_EXTRACT_MODEL",
  "OPENAI_RANK_PUBLISHERS_MODEL",
  "OPENAI_SELECT_PERSONAS_MODEL",
  "OPENAI_EXECUTION_MODEL",
  "OPENAI_REPAIR_MODEL",
  "OPENAI_SERVICE_TIER",
  "OPENAI_REASONING_EFFORT",
  "OPENAI_MAX_OUTPUT_TOKENS",
  "OPENAI_EXTRACT_REASONING_EFFORT",
  "OPENAI_RANK_PUBLISHERS_REASONING_EFFORT",
  "OPENAI_SELECT_PERSONAS_REASONING_EFFORT",
  "OPENAI_EXECUTION_REASONING_EFFORT",
  "OPENAI_REPAIR_REASONING_EFFORT",
  "OPENAI_EXTRACT_MAX_OUTPUT_TOKENS",
  "OPENAI_RANK_PUBLISHERS_MAX_OUTPUT_TOKENS",
  "OPENAI_SELECT_PERSONAS_MAX_OUTPUT_TOKENS",
  "OPENAI_EXECUTION_MAX_OUTPUT_TOKENS",
  "OPENAI_REPAIR_MAX_OUTPUT_TOKENS"
] as const;

describe("OpenAI model selection", () => {
  it("uses the default model when no env model is configured", () => {
    withOpenAIEnv({}, () => {
      expect(getOpenAIModel()).toBe("gpt-5.4-mini");
      expect(getOpenAIModelForStage("extract")).toBe("gpt-5.4-nano");
      expect(getOpenAIModelForStage("rank_publishers")).toBe("gpt-5.4-mini");
      expect(getOpenAIModelForStage("repair")).toBe("gpt-5.4-nano");
    });
  });

  it("falls back to the shared OpenAI model for every stage", () => {
    withOpenAIEnv({ OPENAI_MODEL: "gpt-shared" }, () => {
      for (const stage of openAIModelStages) {
        expect(getOpenAIModelForStage(stage)).toBe("gpt-shared");
      }
    });
  });

  it("uses stage-specific model overrides when configured", () => {
    withOpenAIEnv(
      {
        OPENAI_MODEL: "gpt-shared",
        OPENAI_EXTRACT_MODEL: "gpt-extract",
        OPENAI_RANK_PUBLISHERS_MODEL: "gpt-rank",
        OPENAI_SELECT_PERSONAS_MODEL: "gpt-personas",
        OPENAI_EXECUTION_MODEL: "gpt-execution",
        OPENAI_REPAIR_MODEL: "gpt-repair"
      },
      () => {
        expect(getOpenAIModelForStage("extract")).toBe("gpt-extract");
        expect(getOpenAIModelForStage("rank_publishers")).toBe("gpt-rank");
        expect(getOpenAIModelForStage("select_personas")).toBe("gpt-personas");
        expect(getOpenAIModelForStage("execute")).toBe("gpt-execution");
        expect(getOpenAIModelForStage("repair")).toBe("gpt-repair");
      }
    );
  });

  it("ignores blank stage-specific model overrides", () => {
    withOpenAIEnv({ OPENAI_MODEL: "gpt-shared", OPENAI_EXTRACT_MODEL: "   " }, () => {
      expect(getOpenAIModelForStage("extract")).toBe("gpt-shared");
    });
  });
});

describe("OpenAI request config", () => {
  it("uses fast stage defaults when no env config is set", () => {
    withOpenAIEnv({}, () => {
      expect(getOpenAIRequestConfigForStage("extract")).toEqual({
        reasoningEffort: "none",
        maxOutputTokens: 800,
        serviceTier: undefined
      });
      expect(getOpenAIRequestConfigForStage("rank_publishers")).toEqual({
        reasoningEffort: "none",
        maxOutputTokens: 2000,
        serviceTier: undefined
      });
      expect(getOpenAIRequestConfigForStage("execute")).toEqual({
        reasoningEffort: "none",
        maxOutputTokens: 3000,
        serviceTier: undefined
      });
      expect(getOpenAIRequestConfigForStage("repair")).toEqual({
        reasoningEffort: "none",
        maxOutputTokens: 1800,
        serviceTier: undefined
      });
    });
  });

  it("uses shared reasoning, token cap, and service tier overrides", () => {
    withOpenAIEnv(
      {
        OPENAI_REASONING_EFFORT: "medium",
        OPENAI_MAX_OUTPUT_TOKENS: "1400",
        OPENAI_SERVICE_TIER: "priority"
      },
      () => {
        expect(getOpenAIRequestConfigForStage("select_personas")).toEqual({
          reasoningEffort: "medium",
          maxOutputTokens: 1400,
          serviceTier: "priority"
        });
      }
    );
  });

  it("lets stage overrides win over shared request config", () => {
    withOpenAIEnv(
      {
        OPENAI_REASONING_EFFORT: "medium",
        OPENAI_MAX_OUTPUT_TOKENS: "1400",
        OPENAI_EXECUTION_REASONING_EFFORT: "high",
        OPENAI_EXECUTION_MAX_OUTPUT_TOKENS: "4200"
      },
      () => {
        expect(getOpenAIRequestConfigForStage("execute")).toEqual({
          reasoningEffort: "high",
          maxOutputTokens: 4200,
          serviceTier: undefined
        });
      }
    );
  });

  it("ignores invalid request config overrides", () => {
    withOpenAIEnv(
      {
        OPENAI_REASONING_EFFORT: "turbo",
        OPENAI_MAX_OUTPUT_TOKENS: "-1",
        OPENAI_SERVICE_TIER: "instant"
      },
      () => {
        expect(getOpenAIRequestConfigForStage("rank_publishers")).toEqual({
          reasoningEffort: "none",
          maxOutputTokens: 2000,
          serviceTier: undefined
        });
      }
    );
  });

  it("maps runtime config into Responses API fields", () => {
    expect(
      toResponsesRequestConfig({
        reasoningEffort: "low",
        maxOutputTokens: 1200,
        serviceTier: "priority"
      })
    ).toEqual({
      reasoning: {
        effort: "low"
      },
      max_output_tokens: 1200,
      service_tier: "priority"
    });
  });
});

const openAIModelStages: OpenAIModelStage[] = ["extract", "rank_publishers", "select_personas", "execute", "repair"];

function withOpenAIEnv(values: Partial<Record<(typeof openAIEnvNames)[number], string>>, callback: () => void) {
  const originalValues = new Map(openAIEnvNames.map((name) => [name, process.env[name]]));

  for (const name of openAIEnvNames) {
    delete process.env[name];
  }

  for (const [name, value] of Object.entries(values)) {
    process.env[name] = value;
  }

  try {
    callback();
  } finally {
    for (const name of openAIEnvNames) {
      const originalValue = originalValues.get(name);

      if (originalValue === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalValue;
      }
    }
  }
}
