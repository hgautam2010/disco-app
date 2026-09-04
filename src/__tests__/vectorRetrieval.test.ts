import { describe, expect, it } from "vitest";
import { advertiserAnalysisFixture } from "./helpers/advertiserAnalysis";
import { getPersonas, getPublishers } from "@/lib/data";
import { retrieveCampaignCandidatesForRuntime } from "@/lib/campaign/stages/retrieve-candidates/run";
import { getVectorConfig } from "@/lib/vector/config";
import { advertiserToRetrievalQuery, personaToEmbeddingText, publisherToEmbeddingText } from "@/lib/vector/embeddingText";
import { qdrantPointId } from "@/lib/vector/qdrantClient";

const vectorEnvNames = [
  "QDRANT_URL",
  "QDRANT_API_KEY",
  "QDRANT_PUBLISHERS_COLLECTION",
  "QDRANT_PERSONAS_COLLECTION",
  "OPENAI_API_KEY",
  "OPENAI_EMBEDDING_MODEL",
  "OPENAI_EMBEDDING_DIMENSIONS"
] as const;

describe("vector retrieval helpers", () => {
  it("builds labeled embedding text for publishers and personas", () => {
    const publisher = getPublishers().find((item) => item.id === "pub_007");
    const persona = getPersonas().find((item) => item.id === "persona_004");

    expect(publisher).toBeDefined();
    expect(persona).toBeDefined();

    const publisherText = publisherToEmbeddingText(publisher!);
    const personaText = personaToEmbeddingText(persona!);

    expect(publisherText).toContain("Publisher: Pawline");
    expect(publisherText).toContain("Subcategories: pet_food, pet_supplies, subscription");
    expect(publisherText).toContain("Average order value USD");
    expect(personaText).toContain("Persona: The Pet Parent");
    expect(personaText).toContain("Category affinities: pet_food, pet_supplies, pet_health, subscription_boxes");
    expect(personaText).toContain("Messaging preferences");
  });

  it("builds advertiser retrieval query text from extracted profile fields", () => {
    const query = advertiserToRetrievalQuery(advertiserAnalysisFixture());

    expect(query).toContain("Advertiser pitch: Premium dog food");
    expect(query).toContain("Primary category: pet_food");
    expect(query).toContain("Product signals: subscription, premium, science-backed");
    expect(query).toContain("Likely objective: subscription acquisition");
  });

  it("reads vector config from env with safe defaults", async () => {
    await withVectorEnv(
      {
        QDRANT_URL: "https://example-qdrant.test",
        QDRANT_PUBLISHERS_COLLECTION: "publishers_test",
        QDRANT_PERSONAS_COLLECTION: "personas_test",
        OPENAI_EMBEDDING_MODEL: "text-embedding-test",
        OPENAI_EMBEDDING_DIMENSIONS: "512"
      },
      () => {
        expect(getVectorConfig()).toEqual({
          qdrantUrl: "https://example-qdrant.test",
          qdrantApiKey: undefined,
          publishersCollection: "publishers_test",
          personasCollection: "personas_test",
          embeddingModel: "text-embedding-test",
          embeddingDimensions: 512
        });
      }
    );

    await withVectorEnv(
      {
        OPENAI_EMBEDDING_DIMENSIONS: "-1"
      },
      () => {
        expect(getVectorConfig().embeddingDimensions).toBe(1536);
      }
    );
  });

  it("creates stable UUID point IDs for Qdrant", () => {
    const first = qdrantPointId("publisher", "pub_001");
    const second = qdrantPointId("publisher", "pub_001");
    const differentEntity = qdrantPointId("persona", "pub_001");

    expect(first).toBe(second);
    expect(first).not.toBe(differentEntity);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("requires embeddings for runtime retrieval", async () => {
    await withVectorEnv(
      {
        OPENAI_API_KEY: undefined
      },
      async () => {
        await expect(retrieveCampaignCandidatesForRuntime(advertiserAnalysisFixture())).rejects.toThrow(
          "OPENAI_API_KEY is required to create embeddings."
        );
      }
    );
  });
});

async function withVectorEnv<T>(
  values: Partial<Record<(typeof vectorEnvNames)[number], string | undefined>>,
  callback: () => T | Promise<T>
) {
  const originalValues = new Map(vectorEnvNames.map((name) => [name, process.env[name]]));

  for (const name of vectorEnvNames) {
    delete process.env[name];
  }

  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[name as (typeof vectorEnvNames)[number]];
    } else {
      process.env[name] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const name of vectorEnvNames) {
      const originalValue = originalValues.get(name);

      if (originalValue === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalValue;
      }
    }
  }
}
