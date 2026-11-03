# ADR 0006 — Workflow engine (S4)

**Status:** Accepted for S4  
**Decision class:** Was D5 (evaluate at S4); now CONFIRMADO for Fase 1.

## Context

ADR 0003 deferred choosing Temporal vs an in-house DAG until S4. Automations need durable runs, retries, dry-run, idempotency, and human approval before side effects. Temporal adds an external cluster (workers, persistence, ops) not yet justified for the linear “check goal → notify → approve” paths in Fase 1.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Temporal** | Mature durability, timers, versioning | Extra infra, SDK surface, local/CI complexity |
| **In-house DAG on BullMQ + Postgres** | Reuses Redis already in stack; tenant-scoped in same API | Must own DAG semantics, less feature-rich than Temporal |

## Decision

- **S4–S5:** implement a **linear / shallow DAG workflow engine** on **BullMQ + Postgres** inside `apps/api`.
- **Step allowlist** only (`check_goal`, `notify`, `wait_approval`) — no arbitrary code execution.
- **Dry-run** executes the graph without durable side effects (approvals auto-simulated; notify marked `simulated`).
- **Idempotency-Key** on run start (org-scoped) returns the original run.
- **Approvals** are explicit human decisions; AI assistant must not auto-approve (aligns with ADR 0004).
- **Revisit Temporal** when we need long timers, multi-week human tasks at scale, or cross-service sagas — document trigger criteria in a future ADR.

## Consequences

- `WORKFLOW_QUEUE` worker processes step advancement; tests may set `WORKFLOW_MODE=inline`.
- Product UI “Automatizaciones” manages definitions, runs, and pending approvals.
- Multi-company workflow binding remains gated by `workflow:multi_company` (org owner); S4 definitions may optionally set `companyId` but do not yet orchestrate cross-company graphs.
