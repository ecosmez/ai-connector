# ADR 0007 — MFA first for enterprise identity (S6)

**Status:** Accepted for S6  
**Decision class:** Was deferred in security-model “Deferred to S6”; MFA CONFIRMADO now; SSO/SCIM still deferred.

## Context

Enterprise identity for Fase 1 listed SSO (Entra / Google Workspace), SCIM, MFA/step-up, IP/geo policies, and device inventory. Full SSO + SCIM needs IdP apps, redirect URIs, and provisioning contracts that are heavy for local/CI. MFA via TOTP works entirely in-process and raises the floor for account takeover on local email/password auth.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **TOTP MFA + login step-up first** | No external IdP; testable in CI; immediate login hardening | Does not replace SSO for enterprise IT |
| **OIDC SSO first (Entra/Google)** | Matches enterprise procurement language | Needs live IdP or brittle mocks; slower local loop |
| **SCIM first** | Provisioning | Premature without SSO source of truth |

## Decision

- **S6:** implement **TOTP MFA** (enroll / enable / disable) and **login step-up** (password → MFA challenge → session).
- Secrets: TOTP secret stored encrypted with `MFA_ENCRYPTION_KEY` (fallback to `JWT_SECRET` in local/CI only).
- Challenges: short-lived opaque `mfaToken` (hashed at rest); single-use.
- **SSO (OIDC), SCIM, IP/geo, device inventory** remain deferred to a later enterprise-identity increment (S6b / S7).
- Audit: `user.mfa_enabled`, `user.mfa_disabled`, `user.login_mfa` — never store TOTP secrets or codes.

## Consequences

- Login API may return `{ mfaRequired: true, mfaToken }` instead of a session token.
- Spanish UI: login MFA step + `/app/seguridad` enrollment.
- Org-level “require MFA” policy and IdP bindings are out of scope for this PR.
