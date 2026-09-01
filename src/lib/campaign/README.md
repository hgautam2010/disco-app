# Campaign Pipeline Walkthrough

Start in `pipeline.ts` to see the full campaign flow.

Each stage folder owns one responsibility and keeps related files together:

- `extract-advertiser`: pitch to structured advertiser profile
- `retrieve-candidates`: deterministic publisher and persona candidate retrieval
- `rank-publishers`: publisher recommendations and exclusions
- `select-personas`: shopper persona selection
- `generate-execution`: creative variants and campaign config
- `assemble`: final response and pipeline trace

Shared helpers live in `shared` when they are used by multiple stages.

## Stage Anatomy

- `run.ts`: the stage entry point. It should return a `PipelineStageResult`.
- `prompt.md`: the system prompt for OpenAI-backed stages.
- `schema.ts`: the Zod and JSON schema contract for model output.
- `normalize.ts`: candidate-set repair and consistency rules, when the stage needs them.
- `fallback.ts`: deterministic backup behavior, when the stage needs it.

## Modification Guide

- Change prompt behavior in the stage's `prompt.md`.
- Change expected model JSON in that stage's `schema.ts`.
- Change data passed between stages in `types.ts`.
- Change deterministic candidate logic in `retrieve-candidates/run.ts`, `publisherScoring.ts`, or `personaScoring.ts`.
- Change safety repair in the stage's `normalize.ts` or in `shared/repairResponse.ts`.
- Add a new stage by creating a stage folder, returning a `PipelineStageResult`, wiring it in `pipeline.ts`, and adding focused tests/evals.
