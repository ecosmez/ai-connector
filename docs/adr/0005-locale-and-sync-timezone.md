# ADR 0005 — Product locale and daily sync timezone

**Status:** Accepted (2026-11-02)  
**Decision class:** Was PENDIENTE (D8/D9); now CONFIRMADO by accepting defaults.

## Context

Product language was undefined. Daily analytical sync at 00:00 needed a timezone rule.

## Decision

- **UI/docs locale:** Spanish-first (`es`); English strings may follow via i18n keys.
- **Daily sync:** run at **00:00 in each organization/company timezone** (company TZ when present, else organization TZ).
- **Storage:** IANA timezone names on `organizations.timezone` and optional `companies.timezone`.

## Consequences

- Scheduler must expand “daily 00:00” into per-tenant cron windows, not a single UTC midnight job.
- Copy and empty states in `apps/web` default to Spanish.
