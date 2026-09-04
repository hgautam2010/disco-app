# Runtime Prompts

This directory contains every prompt used by the campaign planner.

- `extract-advertiser.md`
- `rank-publishers.md`
- `select-personas.md`
- `generate-execution.md`
- `repair-response.md`

`src/lib/campaign/shared/prompts.ts` loads these files at runtime, so this directory is the source of truth for prompt review.
