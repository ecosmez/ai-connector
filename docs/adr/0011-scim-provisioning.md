# ADR 0011 — SCIM 2.0 user provisioning (S10)

**Status:** Accepted for S10  
**Decision class:** Deferred from ADR 0010 / security-model (post-S9).

## Context

IdP-driven lifecycle (create / update / deactivate) needs a machine API IdPs can call. Full SCIM (Users + Groups + bulk + discovery) is broad; org admins need a testable path before wiring Entra/Okta apps.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **SCIM 2.0 Users + org bearer token** | Matches IdP connectors; CI-friendly | Groups/roles still manual |
| Reuse SSO JIT only | Already shipped | No deprovision / sync from IdP |
| Full Users+Groups+Bulk | Complete | Too large for one slice |

## Decision

- **S10:** implement **SCIM 2.0 Users** under `/scim/v2/Users` authenticated by an **org-scoped bearer token** (hashed at rest; shown once on create).
- Map SCIM `active=false` / DELETE to membership `status=suspended` (soft), not hard user delete.
- Create/update upserts `User` by email; ensures org membership + `org_member` role binding when active.
- Admin UI `/app/scim` to mint/revoke tokens (Spanish).
- **Groups, Bulk, ServiceProviderConfig extensions, live IdP app registration** remain deferred.

## Consequences

- SCIM requests do not use interactive sessions; audit as `scim.user_*` with `actorUserId` null and token id in metadata.
- Tokens require `organization:manage` to mint; SCIM API itself uses the token’s org context + RLS.
