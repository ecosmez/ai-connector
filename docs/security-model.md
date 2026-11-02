# Security model — S0 + S1

## Authentication

- Local email/password (bcrypt).
- Opaque session tokens hashed at rest; bearer token to API.
- Session carries `userId`, `activeOrganizationId`, optional `activeCompanyId`.

## Authorization

- Permissions are `resource:action` strings (e.g. `organization:read`, `company:manage`, `audit:read`, `connection:manage`, `dashboard:read`).
- Evaluation uses role bindings in the active org (and company when binding is company-scoped).
- Company admins cannot escalate to other companies.
- Platform superadmin role does **not** auto-grant private tenant data (support access later, consented + audited).

## Isolation

- Application policy checks on every mutating/query route.
- PostgreSQL RLS on tenant-owned tables as defense in depth (including `Connection`, `DataSnapshot`, `SyncRun`, `Dashboard`).
- App DB role must be **NOSUPERUSER** and **NOBYPASSRLS** (superusers bypass FORCE RLS).
- Negative tests: cross-org IDOR must return 403/404.

## Sync / idempotency

- Manual sync accepts `Idempotency-Key`; same org+key returns the original `SyncRun`.
- Dashboard GET supports `ETag` / `If-None-Match` (304) for snapshot caching.

## Audit

- Append-only `AuditEvent` rows.
- No password hashes, tokens, or secrets in `metadata`.
- S0 does not yet implement hash-chain/WORM; planned before enterprise audit export.

## Deferred to S6

SSO (Entra, Google Workspace), SCIM, MFA/step-up, IP/geo policies, device inventory UI.
