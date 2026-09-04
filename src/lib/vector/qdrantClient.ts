import { createHash } from "node:crypto";
import { getVectorConfig, type VectorConfig } from "./config";

export type QdrantPoint = {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
};

export type QdrantSearchHit = {
  id: string | number;
  score: number;
  payload: Record<string, unknown>;
};

export type QdrantCollectionEnsureResult = {
  collectionName: string;
  created: boolean;
  vectorSize: number;
  distance: typeof qdrantDistance;
};

type QdrantApiResponse<T> = {
  result?: T;
  status?: string;
  time?: number;
};

type RawQdrantSearchHit = {
  id: string | number;
  score: number;
  payload?: Record<string, unknown> | null;
};

const qdrantDistance = "Cosine" as const;

export async function ensureQdrantCollection(
  collectionName: string,
  config = getVectorConfig()
): Promise<QdrantCollectionEnsureResult> {
  const collectionPath = `/collections/${encodeURIComponent(collectionName)}`;
  const existing = await qdrantFetch(collectionPath, { method: "GET" }, config);

  if (existing.ok) {
    return collectionEnsureResult(collectionName, config, false);
  }

  if (existing.status !== 404) {
    const errorBody = await existing.text();
    throw new Error(`Qdrant collection lookup failed with ${existing.status}: ${errorBody}`);
  }

  await qdrantRequest(
    collectionPath,
    {
      method: "PUT",
      body: JSON.stringify({
        vectors: {
          size: config.embeddingDimensions,
          distance: qdrantDistance
        }
      })
    },
    config
  );

  return collectionEnsureResult(collectionName, config, true);
}

export async function upsertQdrantPoints(collectionName: string, points: QdrantPoint[], config = getVectorConfig()) {
  if (points.length === 0) {
    return;
  }

  await qdrantRequest(
    `/collections/${encodeURIComponent(collectionName)}/points?wait=true`,
    {
      method: "PUT",
      body: JSON.stringify({ points })
    },
    config
  );
}

export async function searchQdrant(
  collectionName: string,
  vector: number[],
  limit: number,
  config = getVectorConfig()
): Promise<QdrantSearchHit[]> {
  const response = await qdrantRequest<RawQdrantSearchHit[]>(
    `/collections/${encodeURIComponent(collectionName)}/points/search`,
    {
      method: "POST",
      body: JSON.stringify({
        vector,
        limit,
        with_payload: true
      })
    },
    config
  );

  return (response.result ?? []).map((hit) => ({
    id: hit.id,
    score: hit.score,
    payload: hit.payload ?? {}
  }));
}

export function qdrantPointId(entityType: "publisher" | "persona", sourceId: string) {
  const hash = createHash("sha1").update(`disco:${entityType}:${sourceId}`).digest();
  const bytes = Uint8Array.from(hash.subarray(0, 16));

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function qdrantRequest<T>(
  path: string,
  init: RequestInit,
  config: VectorConfig
): Promise<QdrantApiResponse<T>> {
  const response = await qdrantFetch(path, init, config);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Qdrant request failed with ${response.status}: ${errorBody}`);
  }

  return (await response.json()) as QdrantApiResponse<T>;
}

async function qdrantFetch(path: string, init: RequestInit, config: VectorConfig) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.qdrantApiKey ? { "api-key": config.qdrantApiKey } : {})
  };
  const url = `${config.qdrantUrl.replace(/\/$/, "")}${path}`;

  try {
    return await fetch(url, {
      ...init,
      headers: {
        ...headers,
        ...init.headers
      }
    });
  } catch (error) {
    throw new Error(
      `Qdrant network request failed for ${path}. Check QDRANT_URL and QDRANT_API_KEY. ${errorMessage(error)}`
    );
  }
}

function collectionEnsureResult(
  collectionName: string,
  config: VectorConfig,
  created: boolean
): QdrantCollectionEnsureResult {
  return {
    collectionName,
    created,
    vectorSize: config.embeddingDimensions,
    distance: qdrantDistance
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown network error.";
}
