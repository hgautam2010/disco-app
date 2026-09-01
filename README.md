# Disco Campaign Planner

A Next.js prototype for Disco's ad placement and creative generation take-home. An advertiser enters a short pitch, and the app returns ranked publisher recommendations, visible exclusions, selected shopper personas, persona-tuned ad copy, and a structured campaign config.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local` to enable full-catalog OpenAI generation. Without a key, the app still runs with deterministic fallback output. `OPENAI_MODEL` defaults to `gpt-5.1`.

## What I Built

The app is optimized for the small catalog provided in the exercise:

- The primary path sends the full publisher and persona catalog to OpenAI with the advertiser pitch and asks for strict structured JSON.
- A normalization layer maps every returned ID back to local catalog data, removes invalid or overlapping choices, repairs budget allocation, and falls back where needed.
- The deterministic TypeScript engine remains as an offline fallback and eval baseline. It also shows how this would evolve when the catalog is too large to fit inline.
- The UI shows recommended publishers, exclusions, personas, creative variants, config, and score signals so the output stays inspectable.

Core entry points:

- `src/lib/campaignEngine.ts`: orchestrates the full campaign generation flow.
- `prompts/full-campaign-generation.md`: the full inline prompt used for the primary OpenAI path.
- `src/lib/openai/generateInlineCampaign.ts`: calls the OpenAI Responses API with the full catalog and a strict JSON schema.
- `src/lib/openai/normalizeCampaign.ts`: validates and repairs model output against the local catalog.
- `src/lib/publisherScoring.ts` and `src/lib/personaScoring.ts`: deterministic fallback and eval baseline.
- `src/app/api/campaign/route.ts`: server-only API route that keeps the API key out of the browser.

## Evals

Run:

```bash
npm run test
npm run eval
```

Unit tests cover scoring mechanics, output validity, and inline-output normalization. The eval harness runs representative advertiser cases from `evals/fixtures/advertiser-cases.json` and writes reports to `evals/reports/`. `evals/fixtures/inline-cases.json` lists manual checks for API-key runs. Current offline eval score: `100`.

## What I Cut

I intentionally kept this to text creative and a small local catalog. I did not add authentication, campaign persistence, image generation, auction simulation, or a real publisher inventory database. Since the provided catalog is only 20 publishers and 10 personas, I chose the simplest high-quality path first: pass the full catalog inline and make the model show its work.

## What Is Hard

The hard part is not rendering cards or calling an LLM. The hard part is keeping recommendations grounded in catalog facts while still letting the model make nuanced judgment calls. Publisher matching also gets harder as the catalog grows because "fit" becomes a retrieval and ranking problem, not a prompt-size problem.

## Another Week

I would replace full-inline catalog prompting with filters, embeddings-backed publisher retrieval, and deterministic reranking before the LLM sees a short candidate set. I would also add richer advertiser extraction, saved campaign drafts, human feedback capture, regression evals, and monitoring for schema failures, fallback rate, latency, and overridden recommendations.
