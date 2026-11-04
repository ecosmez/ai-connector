# ADR 0009 — Platform console (S8)

**Status:** Accepted for S8  
**Decision class:** Deferred domain module from architecture (“platform console”).

## Context

Ops needs a cross-tenant **directory** view (org counts, membership sizes, connector inventory counts) without a support “break-glass” into private snapshots, KPI payloads, or assistant threads. Security-model already states platform superadmin must not auto-grant private tenant data.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Read-only platform console + `isPlatformAdmin`** | Clear blast radius; testable | No SSO-linked ops IdP yet |
| Full support access with consent tokens | Useful for tickets | Too early; high abuse risk |
| SSO/SCIM instead of console | Enterprise IT ask | Separate track (still deferred) |

## Decision

- **S8:** ship a **Spanish Platform console** gated by `User.isPlatformAdmin`.
- Endpoints under `/platform/*` return **aggregates and directory metadata only** (org name/timezone/createdAt, member/company/connection counts). No snapshot payloads, goal values, assistant messages, or MFA secrets.
- Viewing the console emits `platform.console_viewed` audit (orgId null / platform chain).
- SSO/SCIM remain deferred past S8.

## Consequences

- Seed marks a dedicated platform operator (and optionally alice for local demos via explicit flag).
- Tenant admins without `isPlatformAdmin` receive 403 on `/platform/*`.
- Future consented support access needs a separate ADR.
