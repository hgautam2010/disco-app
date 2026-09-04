import { afterEach, describe, expect, it, vi } from "vitest";
import { advertiserAnalysisFixture } from "./helpers/advertiserAnalysis";
import { getPersonas, getPublishers } from "@/lib/data";
import { retrieveCampaignCandidatesForRuntime } from "@/lib/campaign/stages/retrieve-candidates/run";
import { getVectorConfig } from "@/lib/vector/config";
import { advertiserToRetrievalQuery, personaToEmbeddingText, publisherToEmbeddingText } from "@/lib/vector/embeddingText";
import { ensureQdrantCollection, qdrantPointId } from "@/lib/vector/qdrantClient";

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("creates a Qdrant collection when it does not exist", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ status: "not_found" }, 404))
      .mockResolvedValueOnce(jsonResponse({ result: true, status: "ok" }));

    const result = await ensureQdrantCollection("disco_publishers", {
      qdrantUrl: "http://qdrant.test",
      publishersCollection: "disco_publishers",
      personasCollection: "disco_personas",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536
    });

    expect(result).toEqual({
      collectionName: "disco_publishers",
      created: true,
      vectorSize: 1536,
      distance: "Cosine"
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("http://qdrant.test/collections/disco_publishers");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
    expect(fetchSpy.mock.calls[1]?.[0]).toBe("http://qdrant.test/collections/disco_publishers");
    expect(fetchSpy.mock.calls[1]?.[1]).toMatchObject({ method: "PUT" });
    expect(JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body))).toEqual({
      vectors: {
        size: 1536,
        distance: "Cosine"
      }
    });
  });

  it("reuses an existing Qdrant collection", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ result: {}, status: "ok" }));

    const result = await ensureQdrantCollection("disco_personas", {
      qdrantUrl: "http://qdrant.test",
      publishersCollection: "disco_publishers",
      personasCollection: "disco_personas",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536
    });

    expect(result.created).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
