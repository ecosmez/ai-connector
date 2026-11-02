# Architecture — AI Connector

**Status:** Living document for Fase 1 construction  
**Stack ADRs:** [0001](adr/0001-application-stack.md) · [0002](adr/0002-database-and-analytics.md) · [0003](adr/0003-queue-and-workflow-engine.md) · [0004](adr/0004-llm-provider.md) · [0005](adr/0005-locale-and-sync-timezone.md)

## Current shape (S1)

Modular monolith:

| Process | Path | Role |
|---|---|---|
| Web | `apps/web` | Next.js UI (Spanish-first: auth, conexiones, dashboard) |
| API | `apps/api` | NestJS: identity, policy, audit, connectors, sync, dashboards |
| Shared | `packages/shared` | DTOs, permission constants, error codes |
| Postgres | docker-compose / local | OLTP + versioned snapshots |
| Redis | docker-compose / local | BullMQ connection-sync queue |

## Domain modules (API)

- `identity` — users, local auth, sessions
- `tenancy` — organizations, companies, memberships, role bindings
- `policy` — permission evaluation against org/company scope
- `audit` — append-only `audit_events`
- `connectors` — mock connector CRUD
- `sync` — BullMQ workers, manual + scheduled (00:00 TZ) sync, snapshots
- `dashboards` — persistent freshness panel + ETag

Deferred: real ERP/CRM connectors, semantic layer, BI editor, AI wizard, workflows, notifications center, platform console.

## Request path (tenant safety)

1. Authenticate session/JWT.
2. Resolve active `organization_id` (+ optional `company_id`) from server-side session context — never trust bare client IDs.
3. Authorize permission for the route/action.
4. `set_config('app.current_org_id', …)` for RLS.
5. Execute query/command; emit audit event for sensitive mutations.

## Sync path (S1)

1. Manual: `POST .../sync` (+ optional `Idempotency-Key`) → `SyncRun` → queue (or inline in tests).
2. Scheduled: BullMQ repeatable cron `0 0 * * *` with `tz` = company or org IANA timezone.
3. Worker loads connection, runs mock extract, writes `DataSnapshot`, updates `lastSyncedAt`.
4. Dashboard freshness = `fresh` | `stale` | `never` from `lastSyncedAt` vs `staleAfterHours`.

## Non-goals in this codebase stage

- Full BI editor, AI wizard, workflow engine, SSO/SCIM/MFA UI, multi-region DR claims.
