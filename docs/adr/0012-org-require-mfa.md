# ADR 0012 — Organization require-MFA policy (S11)

**Status:** Accepted for S11  
**Decision class:** Deferred from security-model (post-S10).

## Context

S6 shipped per-user TOTP. Enterprise tenants want an org switch that **requires** MFA for local password logins without waiting for IdP-enforced MFA. SSO already treats the IdP as the factor.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Org `requireMfa` + enforce on password login/session** | Simple; fits existing TOTP | Chicken-egg until an admin enrolls first |
| Force enroll mid-login challenge | Smooth UX | Needs provisional session design |
| IdP-only MFA | No local policy | Leaves password tenants uncovered |

## Decision

- Add `Organization.requireMfa` (default false).
- Admins toggle via `PUT /organizations/:id/security-policy` (`organization:manage`).
- **Password** sessions: login denied if the user has any active membership in a `requireMfa` org and has no enabled TOTP; AuthGuard also blocks non-MFA routes when the active org requires MFA and the user lacks TOTP (allows `/auth/mfa/*`, `/auth/me`, logout).
- **SSO** sessions (`Session.authMethod=sso`) are exempt.
- Bootstrap: enable personal MFA before turning on the org policy.

## Consequences

- Spanish UI on `/app/seguridad` for the policy toggle.
- Audit: `organization.require_mfa_updated`.
- IP/geo and device inventory remain deferred.
