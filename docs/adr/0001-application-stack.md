# ADR 0001 — Application stack

**Status:** Accepted (2026-11-02)  
**Decision class:** Was PENDIENTE (D1); now CONFIRMADO by product owner accepting defaults.

## Context

Greenfield repository with no prior stack. Spec §9 proposed a modular monolith first.

## Decision

- **Language/runtime:** TypeScript on Node.js 20+
- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`)
- **Web:** Next.js (App Router) — `apps/web`
- **API:** NestJS modular monolith — `apps/api`
- **Shared types/contracts:** `packages/shared`

Extract independent services only when sync/workflow scale requires it.

## Consequences

- One language across UI and API.
- NestJS modules map 1:1 to domain packages (identity, audit, later connectors/BI/workflows).
- Frontend and API deploy as separate processes sharing types via workspace packages.
