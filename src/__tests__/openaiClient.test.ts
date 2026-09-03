import { describe, expect, it } from "vitest";
import { getOpenAIModel, getOpenAIModelForStage, type OpenAIModelStage } from "@/lib/campaign/shared/openaiClient";

const modelEnvNames = [
  "OPENAI_MODEL",
  "OPENAI_EXTRACT_MODEL",
  "OPENAI_RANK_PUBLISHERS_MODEL",
  "OPENAI_SELECT_PERSONAS_MODEL",
  "OPENAI_EXECUTION_MODEL",
  "OPENAI_REPAIR_MODEL"
] as const;

describe("OpenAI model selection", () => {
  it("uses the default model when no env model is configured", () => {
    withModelEnv({}, () => {
      expect(getOpenAIModel()).toBe("gpt-5.1");
      expect(getOpenAIModelForStage("extract")).toBe("gpt-5.1");
    });
  });

  it("falls back to the shared OpenAI model for every stage", () => {
    withModelEnv({ OPENAI_MODEL: "gpt-shared" }, () => {
      for (const stage of openAIModelStages) {
        expect(getOpenAIModelForStage(stage)).toBe("gpt-shared");
      }
    });
  });

  it("uses stage-specific model overrides when configured", () => {
    withModelEnv(
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
    withModelEnv({ OPENAI_MODEL: "gpt-shared", OPENAI_EXTRACT_MODEL: "   " }, () => {
      expect(getOpenAIModelForStage("extract")).toBe("gpt-shared");
    });
  });
});

const openAIModelStages: OpenAIModelStage[] = ["extract", "rank_publishers", "select_personas", "execute", "repair"];

function withModelEnv(values: Partial<Record<(typeof modelEnvNames)[number], string>>, callback: () => void) {
  const originalValues = new Map(modelEnvNames.map((name) => [name, process.env[name]]));

  for (const name of modelEnvNames) {
    delete process.env[name];
  }

  for (const [name, value] of Object.entries(values)) {
    process.env[name] = value;
  }

  try {
    callback();
  } finally {
    for (const name of modelEnvNames) {
      const originalValue = originalValues.get(name);

      if (originalValue === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalValue;
      }
    }
  }
}
