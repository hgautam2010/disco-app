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

The app is optimized for the small catalog provided in the exercise:

- The primary path runs as three OpenAI-aware stages: extraction first, candidate ranking second, then execution. Deterministic retrieval sits between extraction and ranking so the model only ranks a bounded candidate set.
- Each stage requests strict structured JSON, validates it with Zod, and gets one repair retry if the response misses the contract.
- A normalization layer maps every returned ID back to local catalog data, removes invalid or overlapping choices, repairs budget allocation, and falls back where needed.
- The deterministic TypeScript engine remains as an offline fallback and eval baseline.
- The UI shows recommended publishers, exclusions, personas, creative variants, config, and score signals so the output stays inspectable.

Core entry points:

- `src/lib/campaignEngine.ts`: orchestrates the full campaign generation flow.
- `prompts/advertiser-extraction.md`, `prompts/campaign-ranking.md`, and `prompts/execution-generation.md`: the prompts used by the default staged OpenAI path.
- `prompts/repair-response.md`: the repair prompt used when Zod rejects a stage response.
- `src/lib/openai/generateStagedCampaign.ts`: coordinates extraction, retrieval, ranking, execution, and final assembly.
- `src/lib/pipeline/retrieveCampaignCandidates.ts`: builds the bounded deterministic candidate set.
- `src/lib/pipeline/rankCampaignStrategy.ts` and `src/lib/openai/generateExecution.ts`: call the OpenAI Responses API with strict JSON schemas.
- `src/lib/openai/repairResponse.ts`: validates model output with Zod and retries once with schema errors.
- `src/lib/pipeline/normalizeRankedStrategy.ts` and `src/lib/openai/normalizeExecution.ts`: repair model output against the candidate set and locked strategy.
- `src/lib/validation/campaignSchemas.ts`: Zod contracts for strategy and execution responses.
- `src/lib/publisherScoring.ts` and `src/lib/personaScoring.ts`: deterministic fallback and eval baseline.
- `src/app/api/campaign/route.ts`: server-only API route that keeps the API key out of the browser.

## Evals

Run:

```bash
npm run test
npm run eval
```

Unit tests cover scoring mechanics, output validity, Zod contracts, and staged-output normalization. The eval harness runs representative advertiser cases from `evals/fixtures/advertiser-cases.json` and writes reports to `evals/reports/`. Current offline eval score: `100`.

## What I Cut

I intentionally kept this to text creative and a small local catalog. I did not add authentication, campaign persistence, image generation, auction simulation, or a real publisher inventory database. Since the provided catalog is only 20 publishers and 10 personas, the staged prompt still includes the full catalog for the strategy step.

## What Is Hard

The hard part is not rendering cards or calling an LLM. The hard part is keeping recommendations grounded in catalog facts while still letting the model make nuanced judgment calls. The staged design helps because extraction, matching, creative, and config are separable failure points. Publisher matching still gets harder as the catalog grows because "fit" becomes a retrieval and ranking problem, not a prompt-size problem.

## Another Week

I would replace full-catalog strategy prompting with filters, embeddings-backed publisher retrieval, and deterministic reranking before the LLM sees a short candidate set. I would also add richer advertiser extraction, saved campaign drafts, human feedback capture, regression evals, and monitoring for schema failures, repair rate, fallback rate, latency, and overridden recommendations.
