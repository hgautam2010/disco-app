# Disco Campaign Planner

A Next.js prototype for Disco's ad placement and creative generation take-home. An advertiser enters a short pitch and gets ranked publisher recommendations, excluded publishers, shopper personas, persona-tuned creative, and a structured campaign config.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local`. The shared model default is `gpt-5.6-terra`, with lower-latency `gpt-5.6-luna` defaults for extraction and repair. Optional per-stage model, reasoning effort, output-token, and service-tier overrides are documented in `.env.example`.

Optional Qdrant retrieval:

```bash
docker compose up -d qdrant
npm run ingest:qdrant
```

Then set `CAMPAIGN_RETRIEVER=qdrant` in `.env.local`. If Qdrant or embeddings are unavailable, the app falls back to local retrieval with a stage warning.

## What I Built

The app uses a staged OpenAI pipeline:

```text
extract -> retrieve -> rank_publishers -> select_personas -> generate_execution -> assemble
```

Extraction, publisher ranking, persona selection, and execution are separate OpenAI stages with prompts in `prompts/`. Retrieval defaults to deterministic TypeScript and can optionally use Qdrant semantic retrieval. Final assembly is deterministic TypeScript. Each model response is structured JSON, validated with Zod, and gets one repair retry if it misses the schema.

The UI shows publisher recommendations with reasoning, exclusions, selected personas, 3 to 5 persona-specific creative variants, campaign config, score signals, API call counts, token usage, and a per-stage trace. Trace panels expose model settings, reasoning effort, output cap, service tier, prompt input, parsed model output, normalized stage output, stage-local warnings, and highlighted JSON modals for inspection.

## Core Files

- `src/app/api/campaign/route.ts`: server route that keeps the API key out of the browser.
- `src/lib/campaign/pipeline.ts`: linear campaign orchestration.
- `src/lib/campaign/stages/*`: stage runners, schemas, and normalizers.
- `src/lib/vector/*`: embedding text, OpenAI embedding calls, Qdrant client, and vector config.
- `scripts/ingestQdrant.ts`: embeds the local catalog and upserts Qdrant points.
- `docker-compose.yml`: local Qdrant service for semantic retrieval.
- `prompts/`: runtime prompts used by OpenAI stages and repair.
- `data/`: provided publisher, persona, and advertiser sample data.
- `evals/`: offline regression cases and latest report.

## Evals

Run:

```bash
npm run lint
npm run test
npm run eval
npm run build
```

Unit tests cover scoring, schemas, normalization, candidate retrieval, vector retrieval helpers, Qdrant fallback behavior, trace summaries, warning behavior, stage model selection, and OpenAI key handling. The eval harness runs 14 advertiser cases and the latest offline score is `100`.

## What I Cut

I kept this to text creative and a small local catalog. I did not add auth, persistence, image generation, auction simulation, a real inventory database, or a second deterministic campaign generator.

## What Is Hard

The hard part is keeping recommendations grounded in catalog facts while still letting the model make nuanced calls. The staged design makes extraction, retrieval, ranking, persona selection, creative, and config separately inspectable and easier to evaluate.

## Another Week

I would add incremental embedding refresh jobs, managed Qdrant indexes, persisted run logs, per-stage eval fixtures, saved campaign drafts, human feedback labels, and monitoring for schema failures, repair rate, token usage, latency, retrieval hit quality, and per-stage model performance.
