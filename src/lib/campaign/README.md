# Campaign Pipeline Walkthrough

Start in `pipeline.ts` to see the full campaign flow.

Each stage folder owns one responsibility:

- `extract-advertiser`: pitch to structured advertiser profile
- `retrieve-candidates`: deterministic publisher and persona candidate retrieval
- `rank-publishers`: publisher recommendations and exclusions
- `select-personas`: shopper persona selection
- `generate-execution`: creative variants and campaign config
- `assemble`: final response and pipeline trace

Shared helpers live in `shared` when they are used by multiple stages.
