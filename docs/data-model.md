# Data model — S0–S7

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

## Entities (S2)

| Model | Scope | Purpose |
|---|---|---|
| `SemanticModel` | org + connection (1:1) | Named semantic layer over snapshots |
| `MetricDefinition` | org + semantic model | KPI key/label/`sourcePath`/aggregation/unit |
| `Goal` | org (+ optional company/dashboard) | Target for a `metricKey` with `gte`/`lte` comparator |

## Invariants

- `Company.organizationId` is immutable after create (enforced in service layer).
- Every membership/role binding has explicit scope.
- RLS: tenant tables filter on `current_setting('app.current_org_id', true)`.
- Secrets never stored in audit payloads.
- Snapshot versions are monotonic per connection.
- Daily sync timezone: company TZ when set, else organization TZ.
- One `SemanticModel` per connection; metric keys unique within the model.

## Entities (S3)

| Model | Scope | Purpose |
|---|---|---|
| `AssistantThread` | org + user | Conversation container |
| `AssistantMessage` | org + thread | `user` / `assistant` / `tool` messages; optional `toolPayload` |

## Entities (S4)

| Model | Scope | Purpose |
|---|---|---|
| `WorkflowDefinition` | org (+ optional company) | Named linear step graph (JSON); optional schedule fields (S5) |
| `WorkflowRun` | org + definition | Execution; `dryRun`, optional `idempotencyKey` |
| `WorkflowStepRun` | org + run | Per-step status/output |
| `ApprovalRequest` | org + run/step | Human gate for `wait_approval` |

## Entities (S5)

| Model | Scope | Purpose |
|---|---|---|
| `Notification` | org (+ optional recipient user) | In-app inbox from `notify` steps |

## Entities (S6)

| Model | Scope | Purpose |
|---|---|---|
| `UserMfaFactor` | user | Encrypted TOTP secret + `enabledAt` |
| `MfaChallenge` | user | Short-lived login step-up token (hashed) |

## Audit integrity (S7)

`AuditEvent` gains optional `prevHash` / `eventHash` (SHA-256 hex). New writes always populate both; legacy nulls are skipped until the first hashed event when verifying.

## Later (not migrated yet)

SSO IdP bindings, SCIM, cross-company workflow graphs, Temporal, full BI editor, platform console. AI tools remain read-only for mutations.
