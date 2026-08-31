# Disco Campaign Planner

A Next.js prototype for Disco's ad placement and creative generation take-home. An advertiser enters a short pitch, and the app returns ranked publisher recommendations, visible exclusions, selected shopper personas, persona-tuned ad copy, and a structured campaign config.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local` to enable OpenAI-assisted generation. Without a key, the app still runs with deterministic fallback output. `OPENAI_MODEL` defaults to `gpt-5.1`.

## What I Built

The app uses a hybrid architecture:

- Deterministic TypeScript scoring extracts advertiser signals, ranks publishers, selects personas, computes exclusions, allocates budget, and validates final output.
- The OpenAI layer receives only the advertiser analysis plus top scored candidates, then returns structured JSON for richer reasoning, creative variants, and config language.
- The UI shows both the polished campaign output and the score breakdowns so the recommendation is inspectable rather than black-box.

Core entry points:

- `src/lib/campaignEngine.ts`: orchestrates the full campaign generation flow.
- `src/lib/publisherScoring.ts`: ranks and excludes publishers.
- `src/lib/personaScoring.ts`: selects likely shopper personas.
- `src/lib/openai/generateCampaign.ts`: calls the OpenAI Responses API with a strict JSON schema.
- `src/app/api/campaign/route.ts`: server-only API route that keeps the API key out of the browser.

## Evals

Run:

```bash
npm run test
npm run eval
```

Unit tests cover scoring mechanics and output validity. The eval harness runs representative advertiser cases from `evals/fixtures/advertiser-cases.json` and writes reports to `evals/reports/`. Current eval score: `100`.

## What I Cut

I intentionally kept this to text creative and a small local catalog. I did not add authentication, campaign persistence, image generation, auction simulation, or a real publisher inventory database. Those would distract from the main product question: can the system make defensible placement and messaging decisions from messy advertiser input?

## What Is Hard

The hard part is not rendering cards or calling an LLM. The hard part is deciding which facts should be deterministic, which should be model-generated, and how to keep the model from inventing unsupported rationale. Publisher matching also gets harder as the catalog grows because "fit" becomes a retrieval and ranking problem, not a prompt-size problem.

## Another Week

I would add embeddings-backed publisher retrieval, richer advertiser extraction, saved campaign drafts, side-by-side LLM versus deterministic diffs, human feedback capture, and evals that track regression over time. I would also add monitoring for schema failures, fallback rate, latency, and which recommendation reasons humans override.
