# ADR 0010 — OIDC SSO with mock IdP (S9)

**Status:** Accepted for S9  
**Decision class:** Deferred enterprise identity from ADR 0007 / security-model (post-S8).

## Context

Enterprise buyers expect Entra / Google Workspace SSO. Full multi-IdP OIDC + SCIM needs live apps, redirect URI registration, and provisioning contracts that slow local/CI. MFA (S6) already hardens password login; SSO is the next identity floor without replacing local auth.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **OIDC authorization-code + PKCE with in-process mock IdP** | Same code path as real OIDC; CI without external IdP | Mock is not a compliance substitute |
| Live Entra/Google only | Matches procurement demos | Blocks local/CI; secrets/apps per env |
| SCIM first | Provisioning | Needs SSO source of truth first |
| SAML first | Legacy IdPs | Heavier XML stack; not needed for Fase 1 cloud IdPs |

## Decision

- **S9:** ship **OIDC authorization-code + PKCE** for org-scoped SSO.
- **Mock IdP** (`provider=mock`) runs in the API for local/CI (authorize → code → token/id claims). Real `provider=oidc` reserved for later issuer wiring.
- Org admins enable SSO via `/organizations/:id/sso`; login starts at `/auth/sso/start`.
- JIT: unknown emails may be provisioned as org members when `jitProvisioning=true` (default for mock). Existing members link by `issuer`+`subject`.
- SSO login **skips local TOTP step-up** (IdP is the factor for that path); password login still honors MFA.
- Client secrets encrypted at rest (same AES-GCM helper as MFA).
- **SCIM, IP/geo, device inventory, org-wide require-MFA** remain deferred.

## Consequences

- `User.passwordHash` becomes optional (SSO-only users).
- Spanish UI: login SSO entry + `/app/sso` settings.
- Audit: `sso.config_updated`, `user.login_sso` — never store codes/secrets.
