# Technical Decisions

This document captures the main implementation decisions behind the campaign planner and the tradeoffs they create.

## 1. Use Next.js With a Server API Route

The app uses Next.js because the assignment needs both a polished UI and a secure server-side place to call OpenAI.

- The browser renders the campaign planner interface.
- `src/app/api/campaign/route.ts` owns request validation and server-only campaign generation.
- `OPENAI_API_KEY` stays on the server and is never exposed to client components.

Tradeoff: this is still a prototype, so campaign persistence and auth are intentionally out of scope.

## 2. Use a Staged OpenAI Pipeline

The primary flow is split into stages:

1. Extract advertiser profile.
2. Retrieve bounded publisher and persona candidates.
3. Rank publishers.
4. Select personas.
5. Generate creative and campaign config.
6. Assemble and validate the final result.

This is easier to explain, debug, and evaluate than one large prompt because every stage has a narrow responsibility and its own schema.

Tradeoff: the normal path uses 4 OpenAI calls instead of 1. The benefit is better inspectability and stricter validation.

## 3. Tune OpenAI Runtime Per Stage

The OpenAI client uses stage-level defaults for model, reasoning effort, and output-token caps.

- Extraction and repair default to low-latency settings because they are schema-focused.
- Publisher ranking, persona selection, and execution default to `low` reasoning effort for faster response time.
- `OPENAI_SERVICE_TIER` can opt into a faster OpenAI service tier when available.

The trace records the requested settings and the service tier reported by the API, which makes latency and quality tradeoffs visible during demos.

Tradeoff: lower reasoning effort can reduce nuanced judgment quality, so the important ranking and execution stages can be bumped to `medium` through env vars without code changes.

## 4. Use Qdrant for Runtime Retrieval

Runtime retrieval is Qdrant-backed on this branch:

- catalog ingestion embeds `data/publishers.json` and `data/shopper_personas.json`,
- Qdrant stores publisher and persona points in separate collections,
- runtime embeds the extracted advertiser profile,
- Qdrant returns publisher and persona IDs plus similarity scores,
- local TypeScript hydrates the full records, adds business scoring, fills sparse results, and builds exclusions.

This is more representative of a production catalog search path than prompt-stuffing the full publisher/persona catalog or relying only on hand-tuned rules.

Tradeoff: Qdrant is now required for runtime campaign generation, so local setup needs Docker plus `npm run ingest:qdrant`. The remaining local scoring code is still useful as a deterministic business layer after semantic retrieval and as an offline eval path.

## 5. Use Controlled Extraction Taxonomy

Advertiser extraction uses controlled values for `category`, `secondaryCategories`, and `productSignals`.

The taxonomy lives in `src/lib/advertiserTaxonomy.ts`, and the extraction schema/prompt both reference the same allowed vocabulary.

This improves predictability because downstream scoring can depend on known values instead of free-form model language.

Tradeoff: unknown or new business types may be mapped to `unknown` until the taxonomy is expanded.

## 6. Validate Every Model Response With Zod

Each OpenAI-backed stage requests structured JSON and validates the result with Zod.

If validation fails, the app makes one repair call with:

- the invalid response,
- the validation errors,
- the allowed publisher and persona IDs,
- the same JSON schema contract,
- the relevant stage context.

Tradeoff: repair improves reliability but can double API calls in the worst case.

## 7. Normalize Model Decisions Against Local Data

Model output is treated as a proposal, not final truth.

Normalization ensures:

- recommended publishers exist in the retrieved candidate set,
- excluded publishers do not overlap with recommendations,
- selected personas exist in the retrieved candidate set,
- creative variants only target locked personas,
- budget allocations and placements only use recommended publishers,
- budget percentages sum to 100.

This keeps the final campaign internally consistent even when a model response is slightly messy.

## 8. Make Pipeline Trace Visible

The final response includes a `pipeline` trace with:

- stage name,
- source,
- model,
- request config,
- prompt input for OpenAI-backed stages,
- parsed model output for OpenAI-backed stages,
- retriever input and Qdrant hit output for vector-backed retrieval,
- normalized stage output,
- duration,
- API calls,
- attempts,
- token usage,
- repair status,
- stage-local warnings.

The UI shows a compact summary and an expandable per-stage trace. Each trace data panel has a `View JSON` button that opens a highlighted JSON modal with copy support.

This makes the app easier to demo and gives a clear answer to cost, latency, reliability, prompt payload, model response, and normalization questions.

Tradeoff: trace snapshots can be verbose, so they are collapsed by default and intentionally exclude raw system prompts, JSON schemas, request headers, and secrets.

## 9. Use Offline Evals for Regression Coverage

The eval harness runs representative advertiser cases through deterministic retrieval and scoring.

It checks:

- expected category,
- taxonomy validity,
- candidate publisher recall,
- top publisher fit,
- candidate persona recall,
- persona fit,
- exclusions,
- price tier,
- ambiguity level,
- product signals,
- warning behavior,
- forbidden top publishers.

Tradeoff: offline evals do not fully grade OpenAI writing quality. They are strongest for retrieval, taxonomy, ranking expectations, and regression detection.

## 10. Keep the Code Walkthrough-Oriented

The code is organized around the pipeline rather than around generic abstractions.

Each stage folder has predictable files:

- `run.ts`
- `schema.ts`
- `normalize.ts` when needed

Runtime prompts live in the top-level `prompts/` directory so the submission has one obvious place to review every prompt used by the app.

This makes it easy to modify one stage without mentally loading the entire system, while keeping prompt review separate from implementation code.

## 11. What I Would Improve Next

Given more time, the next production improvements would be:

- persisted campaign drafts,
- persisted run logs for traces and warnings,
- incremental embedding refresh jobs,
- managed Qdrant indexes,
- per-stage eval fixtures,
- human feedback labels,
- monitoring for repair rate, schema failures, token usage, latency, retrieval hit quality, and per-stage model performance.
