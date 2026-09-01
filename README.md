# Disco Campaign Planner

A Next.js prototype for Disco's ad placement and creative generation take-home. An advertiser enters a short pitch, and the app returns ranked publisher recommendations, visible exclusions, selected shopper personas, persona-tuned ad copy, and a structured campaign config.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local` to enable the staged OpenAI pipeline. Without a key, the app still runs with deterministic fallback output. `OPENAI_MODEL` defaults to `gpt-5.1`.

## What I Built

The app is optimized for predictable, inspectable campaign generation:

- The primary path is `extract -> retrieve -> rank_publishers -> select_personas -> execute -> assemble`.
- Extraction, publisher ranking, persona selection, and execution are separate OpenAI-aware stages. Deterministic retrieval sits between extraction and ranking so the model only works from bounded candidate sets.
- Each OpenAI stage requests strict structured JSON, validates it with Zod, and gets one repair retry if the response misses the contract.
- A normalization layer maps every returned ID back to local catalog data, removes invalid or overlapping choices, repairs budget allocation, and falls back where needed.
- The deterministic TypeScript engine powers candidate retrieval, stage fallback, and the offline eval baseline.
- The UI shows recommended publishers, exclusions, personas, creative variants, config, score signals, API call count, repair count, and fallback count so the output stays inspectable.
- Normal OpenAI usage is 4 calls per campaign: extraction, publisher ranking, persona selection, and execution. Worst case is 8 calls if all four stages need one repair retry.

Core entry points:

- `src/lib/campaignEngine.ts`: orchestrates the full campaign generation flow.
- `prompts/advertiser-extraction.md`, `prompts/publisher-ranking.md`, `prompts/persona-selection.md`, and `prompts/execution-generation.md`: the prompts used by the default staged OpenAI path.
- `prompts/repair-response.md`: the repair prompt used when Zod rejects a stage response.
- `src/lib/openai/generateStagedCampaign.ts`: coordinates extraction, retrieval, publisher ranking, persona selection, execution, and final assembly.
- `src/lib/pipeline/extractAdvertiserProfile.ts`: extracts a narrow advertiser profile without publisher or persona decisions.
- `src/lib/pipeline/retrieveCampaignCandidates.ts`: builds the bounded deterministic candidate set.
- `src/lib/pipeline/assembleFinalCampaign.ts`: performs final assembly and records pipeline trace metadata.
- `src/lib/pipeline/rankPublisherStrategy.ts`, `src/lib/pipeline/selectPersonaStrategy.ts`, and `src/lib/openai/generateExecution.ts`: call the OpenAI Responses API with strict JSON schemas.
- `src/lib/openai/repairResponse.ts`: validates model output with Zod and retries once with schema errors.
- `src/lib/pipeline/normalizePublisherStrategy.ts`, `src/lib/pipeline/normalizePersonaStrategy.ts`, and `src/lib/openai/normalizeExecution.ts`: repair model output against the candidate set and locked strategy.
- `src/lib/validation/campaignSchemas.ts`: Zod contracts for extraction, publisher ranking, persona selection, and execution responses.
- `src/lib/publisherScoring.ts` and `src/lib/personaScoring.ts`: deterministic fallback and eval baseline.
- `src/app/api/campaign/route.ts`: server-only API route that keeps the API key out of the browser.

## Implementation Roadmap

1. Keep the current split pipeline as the production path: narrow extraction, deterministic candidate retrieval, publisher ranking, persona selection, execution generation, and final normalization.
2. Expand evals from end-to-end campaign cases into per-stage fixtures so publisher ranking, persona selection, and execution can fail independently without hiding regressions.
3. Add production telemetry for latency, token usage, schema failures, repair rate, fallback rate, and normalized/dropped IDs.
4. Move catalog retrieval to embeddings or indexed search when publisher and persona data grows beyond what deterministic top-k scoring can scan cheaply.
5. Add saved campaign drafts and human feedback labels so future deterministic scoring and prompt changes can be evaluated against real reviewer preferences.

## Evals

Run:

```bash
npm run test
npm run eval
```

Unit tests cover scoring mechanics, output validity, Zod contracts, staged-output normalization, stage fallback, candidate retrieval, and pipeline trace summaries. The eval harness runs 11 representative advertiser cases from `evals/fixtures/advertiser-cases.json` and writes reports to `evals/reports/`. The cases cover happy paths, vague inputs, B2B bad-fit behavior, conflicting price signals, category diversity, expected exclusions, extraction quality, candidate recall, and output validity. Current offline eval score: `100`.

## What I Cut

I intentionally kept this to text creative and a small local catalog. I did not add authentication, campaign persistence, image generation, auction simulation, or a real publisher inventory database. The publisher and persona prompts receive bounded candidate sets rather than the full catalog.

## What Is Hard

The hard part is not rendering cards or calling an LLM. The hard part is keeping recommendations grounded in catalog facts while still letting the model make nuanced judgment calls. The staged design helps because extraction, retrieval, publisher ranking, persona selection, creative, and config are separable failure points. Publisher matching still gets harder as the catalog grows because "fit" becomes a retrieval and ranking problem, not a prompt-size problem.

## Another Week

I would add embeddings-backed retrieval, richer advertiser extraction, saved campaign drafts, human feedback capture, regression evals, and monitoring for schema failures, repair rate, fallback rate, latency, and overridden recommendations.
