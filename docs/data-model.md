# Data model — S0 Foundation

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

## Invariants

- `Company.organizationId` is immutable after create (enforced in service layer).
- Every membership/role binding has explicit scope.
- RLS: tenant tables filter on `current_setting('app.current_org_id', true)`.
- Secrets never stored in audit payloads.

## Later (not migrated in S0)

Connectors, datasets/snapshots, semantic models, dashboards, goals, assistant, workflows, approvals — per spec §10.
