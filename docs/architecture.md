# Architecture — AI Connector

**Status:** Living document for Fase 1 construction  
**Stack ADRs:** [0001](adr/0001-application-stack.md) · [0002](adr/0002-database-and-analytics.md) · [0003](adr/0003-queue-and-workflow-engine.md) · [0004](adr/0004-llm-provider.md) · [0005](adr/0005-locale-and-sync-timezone.md)

## Current shape (S0)

Modular monolith:

| Process | Path | Role |
|---|---|---|
| Web | `apps/web` | Next.js UI (Spanish-first shell, auth screens, context switcher stubs) |
| API | `apps/api` | NestJS BFF/API: identity, policy, audit, health |
| Shared | `packages/shared` | DTOs, permission constants, error codes |
| Postgres | docker-compose / local | OLTP + initial analytics |
| Redis | docker-compose / local | BullMQ (wired in S1 sync workers) |

## Domain modules (API)

Implemented in S0:

- `identity` — users, local auth, sessions
- `tenancy` — organizations, companies, memberships, role bindings
- `policy` — permission evaluation against org/company scope
- `audit` — append-only `audit_events`

Deferred (stubs only where needed): connectors, ingestion, semantic, BI, AI, workflows, notifications center, platform console.

## Request path (tenant safety)

1. Authenticate session/JWT.
2. Resolve active `organization_id` (+ optional `company_id`) from server-side session context — never trust bare client IDs.
3. Authorize permission for the route/action.
4. `set_config('app.current_org_id', …)` for RLS.
5. Execute query/command; emit audit event for sensitive mutations.

## Non-goals in this codebase stage

- Full BI editor, AI wizard, workflow engine, SSO/SCIM/MFA UI, multi-region DR claims.
