# Campaign Pipeline Walkthrough

Start in `pipeline.ts` to see the full campaign flow.

Each stage folder owns one responsibility and keeps related files together:

- `extract-advertiser`: pitch to structured advertiser profile
- `retrieve-candidates`: publisher and persona shortlisting from the local catalog
- `rank-publishers`: publisher recommendations and exclusions
- `select-personas`: shopper persona selection
- `generate-execution`: creative variants and campaign config
- `assemble`: final response and pipeline trace

Shared helpers live in `shared` when they are used by multiple stages.

## Runtime Shape

The campaign path is intentionally linear:

1. `extract-advertiser` turns the pitch into controlled advertiser fields.
2. `retrieve-candidates` builds bounded publisher and persona candidate sets with Qdrant retrieval plus local business scoring.
3. `rank-publishers` asks OpenAI to choose recommended and excluded publishers from those candidates.
4. `select-personas` asks OpenAI to choose personas from the locked candidate set and publisher strategy.
5. `generate-execution` asks OpenAI for persona-specific creative and campaign config.
6. `assemble` validates the final result and attaches pipeline trace metadata.

Every stage returns `PipelineStageResult<T>`, which means the data and trace move together. The final `pipeline` object includes API calls, attempts, repair count, model name, latency, stage-local warnings, token usage, prompt input, model output, and normalized stage output per stage.

Final campaign warnings remain cumulative in the API result. Pipeline trace warnings are stage-local, so a warning created during retrieval does not appear again under ranking, persona selection, or execution unless that stage adds a new warning.

Trace snapshots are business payloads and normalized results. OpenAI stages show the exact prompt input payload, parsed model output, and normalized stage output. Deterministic stages show stage input and stage output. Qdrant retrieval shows the retrieval query, returned hit IDs/scores, and hydrated stage output. The trace intentionally does not include raw system prompts, JSON schema payloads, request headers, or secrets.

## Retrieval Config

Qdrant retrieval is required for the runtime campaign path:

```bash
docker compose up -d qdrant
npm run ingest:qdrant
```

The ingestion script embeds `data/publishers.json` and `data/shopper_personas.json`, then upserts two Qdrant collections. Runtime retrieval embeds the extracted advertiser profile, searches publishers and personas, hydrates full records from local JSON, and adds semantic retrieval signals. If embeddings or Qdrant fail, campaign generation fails clearly so setup issues are visible during development.

## OpenAI Runtime Config

`OPENAI_MODEL` is the shared fallback model. If it is set, every blank stage model override uses it. Without env values, extraction and repair default to `gpt-5.6-luna`, while ranking, persona selection, and execution default to `gpt-5.6-terra`.

Override a single stage only when you want a different cost, latency, or quality profile:

- `OPENAI_EXTRACT_MODEL`: advertiser profile extraction
- `OPENAI_RANK_PUBLISHERS_MODEL`: publisher ranking
- `OPENAI_SELECT_PERSONAS_MODEL`: persona selection
- `OPENAI_EXECUTION_MODEL`: creative and campaign config generation
- `OPENAI_REPAIR_MODEL`: Zod repair retry

Blank stage overrides are ignored and fall back to `OPENAI_MODEL`.

The same file also owns runtime speed controls:

- `OPENAI_REASONING_EFFORT` plus per-stage reasoning overrides
- `OPENAI_MAX_OUTPUT_TOKENS` plus per-stage output-token overrides
- `OPENAI_SERVICE_TIER`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_EMBEDDING_DIMENSIONS`

Each OpenAI trace records the requested reasoning effort, max output tokens, requested service tier, and actual service tier returned by the API when present.

## Stage Anatomy

- `run.ts`: the stage entry point. It should return a `PipelineStageResult`.
- `schema.ts`: the Zod and JSON schema contract for model output.
- `normalize.ts`: candidate-set repair and consistency rules, when the stage needs them.

OpenAI-backed stage prompts live in the top-level `prompts/` directory so every runtime prompt is easy to review in one place.

## Modification Guide

- Change prompt behavior in `prompts/<stage-name>.md`.
- Change expected model JSON in that stage's `schema.ts`.
- Change allowed extraction categories or product signals in `../advertiserTaxonomy.ts`.
- Change data passed between stages in `types.ts`.
- Change local catalog shortlist logic in `retrieve-candidates/run.ts`, `publisherScoring.ts`, or `personaScoring.ts`.
- Change vector retrieval in `retrieve-candidates/vectorRetriever.ts` or `../vector/*`.
- Change safety repair in the stage's `normalize.ts` or in `shared/repairResponse.ts`.
- Add a new stage by creating a stage folder, returning a `PipelineStageResult`, wiring it in `pipeline.ts`, and adding focused tests/evals.
