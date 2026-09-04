export type CampaignRetriever = "local" | "qdrant";

export type VectorConfig = {
  retriever: CampaignRetriever;
  qdrantUrl: string;
  qdrantApiKey?: string;
  publishersCollection: string;
  personasCollection: string;
  embeddingModel: string;
  embeddingDimensions: number;
};

const defaultVectorConfig: VectorConfig = {
  retriever: "local",
  qdrantUrl: "http://localhost:6333",
  publishersCollection: "disco_publishers",
  personasCollection: "disco_personas",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536
};

export function getVectorConfig(): VectorConfig {
  return {
    retriever: readRetrieverEnv() ?? defaultVectorConfig.retriever,
    qdrantUrl: readEnv("QDRANT_URL") ?? defaultVectorConfig.qdrantUrl,
    qdrantApiKey: readEnv("QDRANT_API_KEY"),
    publishersCollection: readEnv("QDRANT_PUBLISHERS_COLLECTION") ?? defaultVectorConfig.publishersCollection,
    personasCollection: readEnv("QDRANT_PERSONAS_COLLECTION") ?? defaultVectorConfig.personasCollection,
    embeddingModel: readEnv("OPENAI_EMBEDDING_MODEL") ?? defaultVectorConfig.embeddingModel,
    embeddingDimensions:
      readPositiveIntegerEnv("OPENAI_EMBEDDING_DIMENSIONS") ?? defaultVectorConfig.embeddingDimensions
  };
}

function readRetrieverEnv(): CampaignRetriever | undefined {
  const value = readEnv("CAMPAIGN_RETRIEVER");

  return value === "local" || value === "qdrant" ? value : undefined;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readPositiveIntegerEnv(name: string) {
  const value = readEnv(name);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
