# Implementation plan

## Accepted defaults (2026-11-02)

| ID | Decision |
|---|---|
| D1 | TypeScript modular monolith — Next.js + NestJS |
| D2/D3 | PostgreSQL for OLTP + initial analytics |
| D4 | Redis/BullMQ for jobs; Temporal evaluation at S4 |
| D5 | **S4:** in-house BullMQ DAG ([ADR 0006](adr/0006-workflow-engine.md)); Temporal deferred |
| D6 | Central OpenAI provider; tool allowlist when AI lands |
| D8/D9 | Spanish-first UI; sync 00:00 per org/company TZ |
| D12 | Authorize docs + S0 Foundation only this increment |

Still open: D7 cloud/region, D10 retention minima, D11 DR targets (do not claim multi-region).

## Slice status

| Slice | Status |
|---|---|
| S0 Foundation | Done (PR #1) |
| S1 Mock connector → sync → dashboard | Done (PR #2) |
| S2 Semantic model + KPIs + goals | Done (PR #3) |
| S3 AI assistant (tool allowlist) | Done (PR #4) |
| S4 Workflows (in-house DAG) | Done (PR #5) |
| S5 Notifications + scheduled workflows | Not started |
| S6 Enterprise identity (SSO/SCIM/MFA) | Not started |
| S7–S8 | Not started (hardening / platform console) |

## S4 exit criteria

- [x] ADR 0006: Temporal vs in-house DAG decision
- [x] `WorkflowDefinition` / `WorkflowRun` / `WorkflowStepRun` / `ApprovalRequest` + RLS
- [x] Step allowlist: `check_goal`, `notify`, `wait_approval`
- [x] Dry-run + `Idempotency-Key` on run start
- [x] Human approval resume path
- [x] Spanish UI `/app/automatizaciones`
- [x] Isolation + engine tests
