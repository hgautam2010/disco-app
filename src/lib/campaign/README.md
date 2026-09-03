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
2. `retrieve-candidates` builds bounded publisher and persona candidate sets in code.
3. `rank-publishers` asks OpenAI to choose recommended and excluded publishers from those candidates.
4. `select-personas` asks OpenAI to choose personas from the locked candidate set and publisher strategy.
5. `generate-execution` asks OpenAI for persona-specific creative and campaign config.
6. `assemble` validates the final result and attaches pipeline trace metadata.

Every stage returns `PipelineStageResult<T>`, which means the data and trace move together. The final `pipeline` object includes API calls, attempts, repair count, model name, latency, stage-local warnings, and token usage per stage.

Final campaign warnings are cumulative and user-facing. Pipeline trace warnings are stage-local, so a warning created during retrieval does not appear again under ranking, persona selection, or execution unless that stage adds a new warning.

## Model Selection

All OpenAI-backed stages use `OPENAI_MODEL` by default. Override a single stage only when you want a different cost, latency, or quality profile:

- `OPENAI_EXTRACT_MODEL`: advertiser profile extraction
- `OPENAI_RANK_PUBLISHERS_MODEL`: publisher ranking
- `OPENAI_SELECT_PERSONAS_MODEL`: persona selection
- `OPENAI_EXECUTION_MODEL`: creative and campaign config generation
- `OPENAI_REPAIR_MODEL`: Zod repair retry

Blank stage overrides are ignored and fall back to `OPENAI_MODEL`.

## Stage Anatomy

- `run.ts`: the stage entry point. It should return a `PipelineStageResult`.
- `prompt.md`: the system prompt for OpenAI-backed stages.
- `schema.ts`: the Zod and JSON schema contract for model output.
- `normalize.ts`: candidate-set repair and consistency rules, when the stage needs them.

## Modification Guide

- Change prompt behavior in the stage's `prompt.md`.
- Change expected model JSON in that stage's `schema.ts`.
- Change allowed extraction categories or product signals in `../advertiserTaxonomy.ts`.
- Change data passed between stages in `types.ts`.
- Change catalog shortlist logic in `retrieve-candidates/run.ts`, `publisherScoring.ts`, or `personaScoring.ts`.
- Change safety repair in the stage's `normalize.ts` or in `shared/repairResponse.ts`.
- Add a new stage by creating a stage folder, returning a `PipelineStageResult`, wiring it in `pipeline.ts`, and adding focused tests/evals.
