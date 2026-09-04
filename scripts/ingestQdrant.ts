import { loadProjectEnv } from "../src/lib/env/loadProjectEnv";
import { getPersonas, getPublishers } from "../src/lib/data";
import {
  personaEmbeddingTextVersion,
  personaToEmbeddingText,
  publisherEmbeddingTextVersion,
  publisherToEmbeddingText
} from "../src/lib/vector/embeddingText";
import { createEmbeddings } from "../src/lib/vector/openaiEmbeddings";
import { getVectorConfig } from "../src/lib/vector/config";
import { ensureQdrantCollection, qdrantPointId, upsertQdrantPoints, type QdrantPoint } from "../src/lib/vector/qdrantClient";
import type { Persona, Publisher } from "../src/lib/types";

loadProjectEnv();

async function main() {
  const config = getVectorConfig();
  const publishers = getPublishers();
  const personas = getPersonas();

  await ensureQdrantCollection(config.publishersCollection, config);
  const publisherPoints = await buildPublisherPoints(publishers, config);
  await upsertQdrantPoints(config.publishersCollection, publisherPoints, config);

  await ensureQdrantCollection(config.personasCollection, config);
  const personaPoints = await buildPersonaPoints(personas, config);
  await upsertQdrantPoints(config.personasCollection, personaPoints, config);
}

async function buildPublisherPoints(publishers: Publisher[], config: ReturnType<typeof getVectorConfig>) {
  const embeddingTexts = publishers.map(publisherToEmbeddingText);
  const result = await createEmbeddings(embeddingTexts, config);

  return publishers.map((publisher, index): QdrantPoint => {
    const vector = result.embeddings[index];

    assertVectorDimensions(vector, config.embeddingDimensions, publisher.id);

    return {
      id: qdrantPointId("publisher", publisher.id),
      vector,
      payload: {
        sourceId: publisher.id,
        entityType: "publisher",
        name: publisher.name,
        category: publisher.category,
        subcategories: publisher.subcategories,
        averageOrderValueUsd: publisher.avg_order_value_usd,
        monthlyImpressions: publisher.monthly_impressions,
        ageSkew: publisher.audience.age_skew,
        incomeTier: publisher.audience.income_tier,
        topGeos: publisher.audience.top_geos,
        embeddingText: embeddingTexts[index],
        embeddingTextVersion: publisherEmbeddingTextVersion,
        embeddingModel: result.model
      }
    };
  });
}

async function buildPersonaPoints(personas: Persona[], config: ReturnType<typeof getVectorConfig>) {
  const embeddingTexts = personas.map(personaToEmbeddingText);
  const result = await createEmbeddings(embeddingTexts, config);

  return personas.map((persona, index): QdrantPoint => {
    const vector = result.embeddings[index];

    assertVectorDimensions(vector, config.embeddingDimensions, persona.id);

    return {
      id: qdrantPointId("persona", persona.id),
      vector,
      payload: {
        sourceId: persona.id,
        entityType: "persona",
        name: persona.name,
        ageRange: persona.age_range,
        genderSkew: persona.gender_skew,
        categoryAffinities: persona.category_affinities,
        priceSensitivity: persona.price_sensitivity,
        typicalAovUsd: persona.typical_aov_usd,
        embeddingText: embeddingTexts[index],
        embeddingTextVersion: personaEmbeddingTextVersion,
        embeddingModel: result.model
      }
    };
  });
}

function assertVectorDimensions(vector: number[] | undefined, expectedDimensions: number, sourceId: string) {
  if (!vector) {
    throw new Error(`No embedding vector returned for ${sourceId}.`);
  }

  if (vector.length !== expectedDimensions) {
    throw new Error(`Embedding vector for ${sourceId} has ${vector.length} dimensions; expected ${expectedDimensions}.`);
  }
}

main();
