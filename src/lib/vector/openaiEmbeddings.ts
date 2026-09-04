import { getVectorConfig, type VectorConfig } from "./config";

export type EmbeddingUsage = {
  inputTokens: number;
  totalTokens: number;
};

export type EmbeddingResult = {
  embeddings: number[][];
  model: string;
  usage: EmbeddingUsage;
};

type EmbeddingsApiResponse = {
  model?: string;
  data?: {
    index: number;
    embedding: number[];
  }[];
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
};

const embeddingsEndpoint = "https://api.openai.com/v1/embeddings";

export async function createEmbedding(input: string, config = getVectorConfig()) {
  const result = await createEmbeddings([input], config);
  const embedding = result.embeddings[0];

  if (!embedding) {
    throw new Error("OpenAI embedding response did not include an embedding.");
  }

  return {
    embedding,
    model: result.model,
    usage: result.usage
  };
}

export async function createEmbeddings(input: string[], config: VectorConfig = getVectorConfig()): Promise<EmbeddingResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to create embeddings.");
  }

  if (input.length === 0) {
    return {
      embeddings: [],
      model: config.embeddingModel,
      usage: {
        inputTokens: 0,
        totalTokens: 0
      }
    };
  }

  const response = await fetch(embeddingsEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.embeddingModel,
      input,
      dimensions: config.embeddingDimensions
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI embeddings request failed with ${response.status}: ${errorBody}`);
  }

  const json = (await response.json()) as EmbeddingsApiResponse;
  const data = [...(json.data ?? [])].sort((a, b) => a.index - b.index);
  const embeddings = data.map((item) => item.embedding);

  if (embeddings.length !== input.length) {
    throw new Error(`OpenAI embeddings response returned ${embeddings.length} embeddings for ${input.length} inputs.`);
  }

  return {
    embeddings,
    model: json.model ?? config.embeddingModel,
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0
    }
  };
}
