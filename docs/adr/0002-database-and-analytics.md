# ADR 0002 — Transactional and analytical storage

**Status:** Accepted (2026-11-02)  
**Decision class:** Was PENDIENTE (D2/D3); now CONFIRMADO by accepting defaults.

## Context

Need multi-tenant isolation with RLS-capable storage and room to grow analytical volume.

## Decision

- **OLTP:** PostgreSQL 16 with Prisma ORM and SQL migrations.
- **Tenant isolation:** `organization_id` on all tenant-owned rows; Postgres RLS enforced per request via `set_config('app.current_org_id', …, true)`.
- **Analytics (initial):** same PostgreSQL database/schemas; versioned snapshots as tables.
- **Later:** introduce a warehouse (BigQuery / Snowflake / ClickHouse) when nightly volume or query patterns justify it — revisit at end of S1/S2.

## Consequences

- Single operational database for S0–S1 simplifies backups and local dev.
- RLS + application policy checks are mandatory; negative cross-tenant tests gate merges.
- Warehouse migration will require dual-write or ETL cutover ADR later.
