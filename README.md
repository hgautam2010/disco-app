# Disco Campaign Planner

A Next.js prototype for Disco's ad placement and creative generation take-home. An advertiser enters a short pitch and gets ranked publisher recommendations, excluded publishers, shopper personas, persona-tuned creative, and a structured campaign config.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local`. `OPENAI_MODEL` defaults to `gpt-5.1`; optional per-stage overrides are documented in `.env.example`.

## What I Built

The app uses a staged OpenAI pipeline:

```text
extract -> retrieve -> rank_publishers -> select_personas -> generate_execution -> assemble
```

Extraction, publisher ranking, persona selection, and execution are separate OpenAI stages with prompts in `prompts/`. Retrieval and final assembly are deterministic TypeScript. Each model response is structured JSON, validated with Zod, and gets one repair retry if it misses the schema.

The UI shows publisher recommendations with reasoning, exclusions, selected personas, 3 to 5 persona-specific creative variants, campaign config, score signals, API call counts, token usage, and a per-stage trace. Trace panels expose prompt input, parsed model output, normalized stage output, stage-local warnings, and highlighted JSON modals for inspection.

## Core Files

- `src/app/api/campaign/route.ts`: server route that keeps the API key out of the browser.
- `src/lib/campaign/pipeline.ts`: linear campaign orchestration.
- `src/lib/campaign/stages/*`: stage runners, schemas, and normalizers.
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

Unit tests cover scoring, schemas, normalization, candidate retrieval, trace summaries, warning behavior, stage model selection, and OpenAI key handling. The eval harness runs 14 advertiser cases and the latest offline score is `100`.

## What I Cut

I kept this to text creative and a small local catalog. I did not add auth, persistence, image generation, auction simulation, a real inventory database, or a second deterministic campaign generator.

## What Is Hard

The hard part is keeping recommendations grounded in catalog facts while still letting the model make nuanced calls. The staged design makes extraction, retrieval, ranking, persona selection, creative, and config separately inspectable and easier to evaluate.

## Another Week

I would add embeddings-backed retrieval for larger catalogs, persisted run logs, per-stage eval fixtures, saved campaign drafts, human feedback labels, and monitoring for schema failures, repair rate, token usage, latency, and per-stage model performance.
