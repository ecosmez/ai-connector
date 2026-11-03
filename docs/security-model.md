# Security model — S0–S5

## Authentication

- Local email/password (bcrypt).
- Opaque session tokens hashed at rest; bearer token to API.
- Session carries `userId`, `activeOrganizationId`, optional `activeCompanyId`.

## Authorization

- Permissions are `resource:action` strings (e.g. `organization:read`, `connection:manage`, `dashboard:read`, `semantic:manage`, `goal:manage`, `assistant:use`).
- Evaluation uses role bindings in the active org (and company when binding is company-scoped).
- Company admins cannot escalate to other companies.
- Platform superadmin role does **not** auto-grant private tenant data (support access later, consented + audited).

## Isolation

- Application policy checks on every mutating/query route.
- PostgreSQL RLS on tenant-owned tables as defense in depth (including workflows/approvals).
- App DB role must be **NOSUPERUSER** and **NOBYPASSRLS** (superusers bypass FORCE RLS).
- Negative tests: cross-org IDOR must return 403/404.

## Assistant (S3)

- Central provider only (no customer BYOK); mock mode for local/CI without keys.
- Tool allowlist is read-only; schema-validated args; tenant-scoped execution.
- User prompts sanitized and wrapped as untrusted; system prompt rejects override attempts.
- Audit stores tool names / round counts — never API keys or full model system prompts.

## Workflows (S4)

- Step types are allowlisted; no arbitrary code execution.
- Dry-run cannot create durable approvals or pretend external notify delivery.
- Approvals require `workflow:manage`; assistant must not auto-approve.
- Run start supports `Idempotency-Key` to prevent duplicate side-effecting executions.

## Notifications (S5)

- `notification:read` gates inbox access; org-wide notifications (null recipient) are visible to permitted members.
- Dry-run never inserts `Notification` rows.
- Scheduled workflow ticks are org-scoped and do not bypass RLS when creating runs/notifications.

## Sync / idempotency

- Manual sync accepts `Idempotency-Key`; same org+key returns the original `SyncRun`.
- Dashboard GET supports `ETag` / `If-None-Match` (304) for snapshot caching.

## Audit

- Append-only `AuditEvent` rows.
- No password hashes, tokens, or secrets in `metadata`.
- S0 does not yet implement hash-chain/WORM; planned before enterprise audit export.

## Deferred to S6

SSO (Entra, Google Workspace), SCIM, MFA/step-up, IP/geo policies, device inventory UI.
