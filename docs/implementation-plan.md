# Implementation plan

## Accepted defaults (2026-11-02)

| ID | Decision |
|---|---|
| D1 | TypeScript modular monolith — Next.js + NestJS |
| D2/D3 | PostgreSQL for OLTP + initial analytics |
| D4 | Redis/BullMQ for jobs; Temporal evaluation at S4 |
| D6 | Central OpenAI provider; tool allowlist when AI lands |
| D8/D9 | Spanish-first UI; sync 00:00 per org/company TZ |
| D12 | Authorize docs + S0 Foundation only this increment |

Still open: D7 cloud/region, D10 retention minima, D11 DR targets (do not claim multi-region).

## Slice status

| Slice | Status |
|---|---|
| S0 Foundation | Done (PR #1) |
| S1 Mock connector → sync → dashboard | Done (PR #2) |
| S2 Semantic model + KPIs + goals | In progress (this PR) |
| S3–S8 | Not started (S3 = AI wizard) |

## S0 exit criteria

- [x] ADRs committed
- [x] Register/login/session context switch
- [x] Org + company CRUD with RBAC
- [x] Append-only audit on sensitive actions
- [x] RLS + cross-tenant denial tests green
- [x] CI workflow runs lint/typecheck/tests

## S1 exit criteria

- [x] Mock connector CRUD (`connection:manage`)
- [x] Manual sync with `Idempotency-Key`
- [x] BullMQ worker + daily schedule at 00:00 org/company TZ
- [x] Versioned `DataSnapshot` in Postgres
- [x] Persistent dashboard with freshness (`fresh` / `stale` / `never`) + ETag
- [x] RLS + cross-tenant denial tests for new tables
- [x] Spanish UI: Conexiones + Dashboard

## S2 exit criteria

- [x] `SemanticModel` + `MetricDefinition` with RLS
- [x] Auto-bootstrap mock metrics on connection create
- [x] KPI resolution from snapshot (`metrics.*`, `rows.*.field` aggregations)
- [x] `Goal` CRUD + evaluation (En meta / Fuera de meta / Sin dato)
- [x] Dashboard payload includes `kpis` + `goals`
- [x] Spanish UI: Análisis KPIs/metas + página Metas
- [x] Isolation tests for semantic/goals
