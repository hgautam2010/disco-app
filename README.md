# Disco Campaign Planner

A Next.js prototype for Disco's ad placement and creative generation take-home. An advertiser enters a short pitch, and the app returns ranked publisher recommendations, visible exclusions, selected shopper personas, persona-tuned ad copy, and a structured campaign config.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local`; campaign generation requires OpenAI. `OPENAI_MODEL` defaults to `gpt-5.1`.

Optional stage-specific model overrides:

```bash
OPENAI_EXTRACT_MODEL=
OPENAI_RANK_PUBLISHERS_MODEL=
OPENAI_SELECT_PERSONAS_MODEL=
OPENAI_EXECUTION_MODEL=
OPENAI_REPAIR_MODEL=
```

Any blank stage override falls back to `OPENAI_MODEL`, so local setup only needs one model unless you want to tune cost or quality per stage.

## What I Built

The app is optimized for predictable, inspectable campaign generation:

- The primary path lives in `src/lib/campaign` and runs `extract -> retrieve -> rank_publishers -> select_personas -> generate_execution -> assemble`.
- Extraction, publisher ranking, persona selection, and execution are separate OpenAI stages. Deterministic retrieval sits between extraction and ranking so the model only works from bounded candidate sets.
- Each OpenAI stage can use its own model through an env override, while blank overrides fall back to `OPENAI_MODEL`.
- Each stage has its own folder with the local prompt, schema, runner, and any normalizer needed for that responsibility.
- Each OpenAI stage requests strict structured JSON, validates it with Zod, and gets one repair retry if the response misses the contract.
- Advertiser extraction uses a small controlled taxonomy for `category`, `secondaryCategories`, and `productSignals`, which keeps matching predictable.
- A normalization layer maps every returned ID back to local catalog data, removes invalid or overlapping choices, and repairs budget allocation.
- Deterministic TypeScript code is only used for catalog shortlisting, normalization, and offline evals.
- The UI shows recommended publishers, exclusions, personas, creative variants, config, score signals, API calls, repair count, and an expandable per-stage trace with model, attempts, latency, token usage, stage-local warnings, and input/output payload snapshots.
- Normal OpenAI usage is 4 calls per campaign: extraction, publisher ranking, persona selection, and execution. Worst case is 8 calls if all four stages need one repair retry.

Core entry points:

- `src/lib/campaignEngine.ts`: orchestrates the full campaign generation flow.
- `src/lib/campaign/pipeline.ts`: coordinates extraction, retrieval, publisher ranking, persona selection, execution, and final assembly.
- `src/lib/campaign/types.ts`: shared internal contracts passed between stages.
- `src/lib/campaign/stages/extract-advertiser`: extracts a narrow advertiser profile without publisher or persona decisions.
- `src/lib/campaign/stages/retrieve-candidates`: builds the bounded deterministic publisher and persona candidate set.
- `src/lib/campaign/stages/rank-publishers`: ranks recommended publishers and exclusions from publisher candidates.
- `src/lib/campaign/stages/select-personas`: selects shopper personas from persona candidates and locked publisher decisions.
- `src/lib/campaign/stages/generate-execution`: writes persona-specific ad copy and campaign config.
- `src/lib/campaign/stages/assemble`: performs final assembly and records pipeline trace metadata.
- `src/lib/campaign/shared`: shared OpenAI client, structured response repair, prompt loading, and normalization helpers.
- `src/lib/campaign/shared/repair-response.md`: repair prompt used when Zod rejects a stage response.
- `src/lib/advertiserTaxonomy.ts`: controlled extraction categories and product-signal values.
- `src/lib/publisherScoring.ts` and `src/lib/personaScoring.ts`: deterministic catalog shortlist scoring.
- `src/lib/schemas.ts`: final campaign result validation.
- `src/app/api/campaign/route.ts`: server-only API route that keeps the API key out of the browser.

## Remaining Roadmap

1. Keep the current split pipeline as the production path: narrow extraction, deterministic candidate retrieval, publisher ranking, persona selection, execution generation, and final normalization.
2. Expand evals from end-to-end campaign cases into per-stage fixtures so publisher ranking, persona selection, and execution can fail independently without hiding regressions.
3. Add persisted run logs for schema failures, repair rate, token usage, latency, and normalized/dropped IDs.
4. Move catalog retrieval to embeddings or indexed search when publisher and persona data grows beyond what deterministic top-k scoring can scan cheaply.
5. Add saved campaign drafts and human feedback labels so prompt and retrieval changes can be evaluated against real reviewer preferences.

## Evals

Run:

```bash
npm run test
npm run eval
```

Unit tests cover scoring mechanics, Zod contracts, staged-output normalization, candidate retrieval, pipeline trace summaries, and the OpenAI API key requirement. The eval harness runs 14 representative advertiser cases from `evals/fixtures/advertiser-cases.json` and writes reports to `evals/reports/`. The cases cover happy paths, vague inputs, unknown-category handling, B2B bad-fit behavior, conflicting price signals, category diversity, expected exclusions, extraction taxonomy checks, and candidate recall. Current offline eval score: `100`.

## What I Cut

I intentionally kept this to text creative and a small local catalog. I did not add authentication, campaign persistence, image generation, auction simulation, a real publisher inventory database, or a second deterministic campaign generator. The publisher and persona prompts receive bounded candidate sets rather than the full catalog.

## What Is Hard

The hard part is not rendering cards or calling an LLM. The hard part is keeping recommendations grounded in catalog facts while still letting the model make nuanced judgment calls. The staged design helps because extraction, retrieval, publisher ranking, persona selection, creative, and config are separable failure points. Publisher matching still gets harder as the catalog grows because "fit" becomes a retrieval and ranking problem, not a prompt-size problem.

## Another Week

I would add embeddings-backed retrieval, richer advertiser extraction, saved campaign drafts, human feedback capture, regression evals, and monitoring for schema failures, repair rate, latency, and overridden recommendations.
