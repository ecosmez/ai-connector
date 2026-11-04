# Security model — S0–S11

## Authentication

- Local email/password (bcrypt).
- Opaque session tokens hashed at rest; bearer token to API.
- Session carries `userId`, `activeOrganizationId`, optional `activeCompanyId`.
- **S6 MFA (TOTP):** when enabled, login returns `mfaRequired` + short-lived `mfaToken`; session issued only after `/auth/mfa/verify`. TOTP secrets encrypted at rest (`MFA_ENCRYPTION_KEY`).

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
- **S7 hash-chain:** each event stores `prevHash` + `eventHash` (SHA-256); see [ADR 0008](adr/0008-audit-hash-chain.md). Export/verify endpoints expose `chainValid`. True WORM still deferred.

## MFA (S6)

- See [ADR 0007](adr/0007-mfa-and-enterprise-identity.md).
- Audit: `user.mfa_enabled`, `user.mfa_disabled`, `user.login_mfa`, `user.login_mfa_challenge` — never codes/secrets.

## Platform console (S8)

- `isPlatformAdmin` is explicit; does **not** unlock tenant snapshots, assistant threads, MFA secrets, or audit export of foreign orgs via tenant routes.
- `/platform/*` returns directory aggregates only; views are audited as `platform.console_viewed`.

## SSO (S9)

- Org-scoped OIDC authorization-code + PKCE ([ADR 0010](adr/0010-oidc-sso.md)).
- Mock IdP in-process for local/CI; external `oidc` provider reserved.
- Client secrets encrypted at rest; SSO login skips local TOTP (IdP is the factor).
- Audit: `sso.config_updated`, `user.login_sso` — never codes/secrets.

## SCIM (S10)

- Org-scoped bearer tokens (hashed at rest; shown once) for `/scim/v2/Users` ([ADR 0011](adr/0011-scim-provisioning.md)).
- Soft deprovision: membership `suspended`; no hard user delete via SCIM.
- Audit: `scim.token_*`, `scim.user_*` — never raw tokens.

## Org require-MFA (S11)

- `Organization.requireMfa` ([ADR 0012](adr/0012-org-require-mfa.md)).
- Password login denied without enabled TOTP if any membership org requires MFA.
- AuthGuard blocks non-MFA routes for password sessions in requireMfa active org.
- SSO sessions (`authMethod=sso`) are exempt.
- Audit: `organization.require_mfa_updated`.

## Deferred (post-S11)

External Entra/Google issuer wiring, SCIM Groups/Bulk, IP/geo policies, device inventory UI, consented support break-glass.
