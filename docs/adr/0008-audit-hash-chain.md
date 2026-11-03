# ADR 0008 — Audit event hash-chain (S7)

**Status:** Accepted for S7  
**Decision class:** Security-model deferred “hash-chain/WORM before enterprise audit export”.

## Context

`AuditEvent` rows are append-only by convention but a DB operator (or compromised app role) could alter `metadata`/`action` without detection. Enterprise audit export needs a tamper-evident trail before claiming WORM compliance.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Per-org hash chain** | Detects in-place edits; exportable | Not true WORM; needs sequential write |
| External WORM store (S3 Object Lock) | Strong immutability | Infra + ops before product needs it |
| Signed events (asymmetric) | Non-repudiation | Key mgmt heavy for Fase 1 |

## Decision

- **S7:** each new `AuditEvent` stores `prevHash` + `eventHash` = SHA-256 over a canonical payload including the previous event’s hash (genesis = 64 zero hex).
- Chain is **scoped by `organizationId`** (platform/null-org events use a separate `"platform"` chain key).
- `GET .../audit-events/export` returns events oldest-first plus `chainValid`.
- `GET .../audit-events/verify` recomputes the chain without export payload bulk.
- True WORM / Object Lock remains deferred.

## Consequences

- `AuditService.record` must serialize inserts per org (transaction + lock last row) so `prevHash` is correct under concurrency.
- Existing rows without hashes are treated as pre-chain history; verification starts at the first hashed event.
- Spanish UI `/app/auditoria` lists events and shows chain status / download export.
