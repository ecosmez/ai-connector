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
| S0 Foundation | In progress (this PR) |
| S1 Mock connector → sync → dashboard | Not started |
| S2–S8 | Not started |

## S0 exit criteria

- [x] ADRs committed
- [x] Register/login/session context switch
- [x] Org + company CRUD with RBAC
- [x] Append-only audit on sensitive actions
- [x] RLS + cross-tenant denial tests green
- [x] CI workflow runs lint/typecheck/tests
