# Implementation Walkthrough

Use this guide to explain the project quickly from code structure to runtime behavior.

## 1. Start With the User Flow

The user enters an advertiser pitch in the planner UI.

The client sends that pitch to:

`src/app/api/campaign/route.ts`

That route validates the request body, checks for `OPENAI_API_KEY`, and calls the campaign engine.

## 2. Campaign Entry Point

The main orchestration starts at:

`src/lib/campaignEngine.ts`

That file delegates to:

`src/lib/campaign/pipeline.ts`

The pipeline is intentionally linear:

```ts
extract -> retrieve -> rank_publishers -> select_personas -> generate_execution -> assemble
```

Each step returns data plus trace metadata.

The trace is designed for demos: each stage can show the payload it received, the parsed model response when OpenAI was involved, and the normalized output that moved to the next step.

## 3. Extract Advertiser Profile

Folder:

`src/lib/campaign/stages/extract-advertiser`

This stage reads the advertiser pitch and returns:

- category,
- secondary categories,
- price tier,
- audience hints,
- product signals,
- value propositions,
- purchase model,
- likely objective,
- ambiguity level,
- confidence.

Key files:

- `prompts/extract-advertiser.md`: explains the extraction job and allowed values.
- `schema.ts`: defines the Zod and JSON schema contract.
- `normalize.ts`: trims free-text fields, deduplicates arrays, and adds extraction warnings.
- `run.ts`: sends the OpenAI request and returns a `PipelineStageResult`.

The important design point: this stage does not choose publishers, personas, creative, or campaign config.

## 4. Load Full Catalogue

Folder:

`src/lib/campaign/stages/retrieve-candidates`

This stage is deterministic. It loads the supplied publisher and persona catalogues without scoring, sorting, slicing, or preselecting.

Supporting files:

- `data/publishers.json`
- `data/shopper_personas.json`

The output is `CampaignCatalogue`: advertiser profile, full publishers, full personas, and any catalogue-level warnings. OpenAI receives only the relevant full catalogue for the next decision:

- publisher ranking receives all publishers,
- persona selection receives all personas,
- execution receives only the selected publishers and personas.

## 5. Rank Publishers

Folder:

`src/lib/campaign/stages/rank-publishers`

This OpenAI stage chooses:

- recommended publishers,
- excluded publishers,
- reasons,
- risks,
- scoring signals,
- warnings.

The model can only choose from publisher IDs in the supplied publisher catalogue. The normalizer drops unknown IDs and fills missing recommendations from the same catalogue if needed.

## 6. Select Personas

Folder:

`src/lib/campaign/stages/select-personas`

This OpenAI stage chooses shopper personas from the full persona catalogue, using the locked publisher strategy as context.

The output includes:

- selected persona IDs,
- scores,
- reasons,
- risks,
- messaging angles,
- warnings.

The normalizer validates every persona ID against the supplied persona catalogue.

## 7. Generate Creative and Config

Folder:

`src/lib/campaign/stages/generate-execution`

This OpenAI stage writes the final execution layer:

- creative variants for selected personas,
- campaign objective,
- budget,
- targeting,
- placements,
- bid strategy,
- measurement plan.

The normalizer keeps creative tied to selected personas and keeps budget/placements tied to recommended publishers.

## 8. Assemble the Final Campaign

Folder:

`src/lib/campaign/stages/assemble`

This stage combines strategy and execution, validates the final result, and attaches pipeline trace metadata.

The final response includes:

- advertiser analysis,
- recommended publishers,
- excluded publishers,
- selected personas,
- creative variants,
- campaign config,
- cumulative API warnings,
- pipeline trace.

The UI does not render a separate global warnings banner. Warnings are easier to explain from the stage that created them, so the visible warnings live inside each stage's trace.

## 9. OpenAI Call Count

Normal flow:

- extraction: 1 call,
- publisher ranking: 1 call,
- persona selection: 1 call,
- execution generation: 1 call.

Normal total: 4 OpenAI calls.

Worst case:

- each OpenAI stage can make one repair retry if Zod validation fails.

Worst-case total: 8 OpenAI calls.

Retrieval and assembly are deterministic and do not call OpenAI.

## 10. Speed and Quality Controls

OpenAI runtime defaults live in:

`src/lib/campaign/shared/openaiClient.ts`

The app supports:

- `OPENAI_MODEL` and per-stage model overrides,
- `OPENAI_REASONING_EFFORT` and per-stage reasoning overrides,
- `OPENAI_MAX_OUTPUT_TOKENS` and per-stage output-token overrides,
- `OPENAI_SERVICE_TIER` for faster serving when available.

The default shape is optimized for a fast take-home demo: extraction and repair use `none` reasoning effort, while ranking, persona selection, and execution use `low`. If output quality needs more careful judgment, bump ranking/persona/execution to `medium` in `.env.local`.

## 11. Validation and Repair

Shared logic:

- `src/lib/campaign/shared/structuredGeneration.ts`
- `src/lib/campaign/shared/repairResponse.ts`
- `prompts/repair-response.md`

Each OpenAI-backed stage:

1. Requests strict structured JSON.
2. Parses the model response.
3. Validates it with Zod.
4. Returns valid data immediately if it passes.
5. Makes one repair call if validation fails.
6. Throws a structured error if repair also fails.

## 12. Token Usage and Trace

Shared files:

- `src/lib/campaign/shared/openaiClient.ts`
- `src/lib/campaign/shared/tokenUsage.ts`

Each stage trace records:

- stage name,
- source,
- model,
- reasoning effort,
- max output tokens,
- service tier,
- prompt input for OpenAI stages or stage input for deterministic stages,
- parsed model output for OpenAI stages,
- normalized stage output,
- duration,
- API calls,
- attempts,
- token usage,
- repair status,
- stage-local warnings.

The UI renders this in:

`src/components/CampaignPlanner.tsx`

The trace UI starts compact. Expanding `Trace data` shows inline JSON previews, and each preview has a `View JSON` button that opens a highlighted modal with copy support.

This makes the pipeline easy to inspect during demos without flooding the page. The trace shows business payloads and parsed outputs, not request headers, raw schemas, secrets, or full system prompt text.

## 13. Evals and Tests

Run:

```bash
npm run lint
npm run test
npm run eval
npm run build
```

Important test files:

- `src/__tests__/campaignSchemas.test.ts`
- `src/__tests__/pipelineStages.test.ts`
- `src/__tests__/stagedCampaignNormalization.test.ts`
- `src/__tests__/publisherScoring.test.ts`
- `src/__tests__/personaScoring.test.ts`
- `src/__tests__/campaignEngine.test.ts`
- `src/__tests__/campaignWarnings.test.ts`
- `src/__tests__/openaiClient.test.ts`

Eval files:

- `evals/fixtures/advertiser-cases.json`
- `evals/runEvals.ts`
- `evals/reports/latest.md`
- `evals/reports/latest.json`

Current eval suite has 14 cases and covers happy paths, ambiguous inputs, unknown-category handling, B2B bad-fit behavior, expected exclusions, forbidden top publishers, price tiers, and product-signal taxonomy.

## 14. How to Modify Safely

Common changes:

- Add a new category or product signal in `src/lib/advertiserTaxonomy.ts`.
- Update extraction behavior in `prompts/extract-advertiser.md`.
- Change model, reasoning, output cap, or service tier defaults in `src/lib/campaign/shared/openaiClient.ts`.
- Update a stage response shape in that stage's `schema.ts`.
- Update stage repair/cleanup in that stage's `normalize.ts`.
- Change catalogue loading in `src/lib/campaign/stages/retrieve-candidates/run.ts`.
- Tune ranking or persona-selection behavior in the matching prompt file under `prompts/`.
- Add eval coverage in `evals/fixtures/advertiser-cases.json`.

After any change, run lint, tests, evals, and build.
