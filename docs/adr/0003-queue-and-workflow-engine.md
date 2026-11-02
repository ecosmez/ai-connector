# ADR 0003 — Queue and workflow engine

**Status:** Accepted for queue; workflow engine deferred evaluation  
**Decision class:** Was PENDIENTE (D4/D5); D4 accepted, D5 scheduled for S4.

## Context

Nightly sync, manual sync, and later automations need durable jobs with retries and tenant-aware fairness.

## Decision

- **S0–S3 jobs:** Redis + BullMQ for scheduled/manual sync and background work.
- **S4 workflow engine:** evaluate Temporal vs in-house DAG before implementing workflow core; do not lock S0 to Temporal.

## Consequences

- `REDIS_URL` is required for workers; API can boot without a worker process in early slices.
- Workflow ADR will be written at S4 kickoff with dry-run, idempotency, and approval requirements from the product spec.
