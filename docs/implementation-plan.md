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
| S2 Semantic model + KPIs + goals | Done (PR #3) |
| S3 AI assistant (tool allowlist) | In progress (this PR) |
| S4–S8 | Not started (S4 = workflows eval) |

## S0–S2 exit criteria

See prior PRs / checklists (all complete).

## S3 exit criteria

- [x] Feature-flagged assistant (`AI_ENABLED`) with OpenAI adapter + mock provider
- [x] `AssistantThread` / `AssistantMessage` + RLS
- [x] Read-only tool allowlist (dashboards, KPIs, goals, semantic metrics)
- [x] User-text sanitization / untrusted wrapping (prompt-injection hardening)
- [x] Audit `assistant.turn` without secrets
- [x] Spanish UI `/app/asistente`
- [x] Isolation + mock-provider tests
