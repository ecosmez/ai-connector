# ADR 0003 — Queue and workflow engine

**Status:** Accepted for queue; workflow engine decided in [ADR 0006](0006-workflow-engine.md)  
**Decision class:** Was PENDIENTE (D4/D5); D4 accepted; D5 resolved at S4.

## Context

Nightly sync, manual sync, and later automations need durable jobs with retries and tenant-aware fairness.

## Decision

- **Jobs (D4):** Redis + BullMQ for scheduled/manual sync and background work (unchanged).
- **Workflow engine (D5):** see **ADR 0006** — in-house BullMQ + Postgres DAG for S4; Temporal deferred.

## Consequences

- `REDIS_URL` is required for workers; API can boot without a worker process in early slices.
- Workflow dry-run, idempotency, and approval requirements are implemented in the S4 workflow module.
