# Data model — S0 Foundation + S1

See also product spec §10. Table names below match Prisma models.

## Entities (S0)

| Model | Scope | Purpose |
|---|---|---|
| `User` | global | Login identity (email unique) |
| `Organization` | root tenant | Isolation boundary; default timezone |
| `Company` | `organizationId` | Belongs to exactly one org |
| `Membership` | org (+ optional company) | User belongs to org |
| `Role` | org or platform | Named role |
| `Permission` | global catalog | Resource + action |
| `RolePermission` | role | Grants |
| `RoleBinding` | org + optional company | User↔role scoped binding |
| `Session` | user | Revocable sessions; stores active org context |
| `AuditEvent` | `organizationId` nullable for platform | Append-only log |

## Entities (S1)

| Model | Scope | Purpose |
|---|---|---|
| `Connection` | org (+ optional company) | Connector instance (`provider=mock` in S1) |
| `DataSnapshot` | org + connection | Versioned extract (`payload`, `etag`, `rowCount`) |
| `SyncRun` | org + connection | Manual/scheduled job status; optional `idempotencyKey` |
| `Dashboard` | org (+ optional company) | Persistent panel bound to one connection; `staleAfterHours` (default 26) |

## Invariants

- `Company.organizationId` is immutable after create (enforced in service layer).
- Every membership/role binding has explicit scope.
- RLS: tenant tables filter on `current_setting('app.current_org_id', true)`.
- Secrets never stored in audit payloads.
- Snapshot versions are monotonic per connection.
- Daily sync timezone: company TZ when set, else organization TZ.

## Later (not migrated yet)

Semantic models, goals, assistant, workflows, approvals — per spec §10.
