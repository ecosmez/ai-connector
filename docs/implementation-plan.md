# Implementation plan

## Accepted defaults (2026-11-02)

| ID | Decision |
|---|---|
| D1 | TypeScript modular monolith — Next.js + NestJS |
| D2/D3 | PostgreSQL for OLTP + initial analytics |
| D4 | Redis/BullMQ for jobs; Temporal evaluation at S4 |
| D5 | **S4:** in-house BullMQ DAG ([ADR 0006](adr/0006-workflow-engine.md)); Temporal deferred |
| D6 | Central OpenAI provider; tool allowlist when AI lands |
| D8/D9 | Spanish-first UI; sync 00:00 per org/company TZ |
| D12 | Authorize docs + S0 Foundation only this increment |

Still open: D7 cloud/region, D10 retention minima, D11 DR targets (do not claim multi-region).

## Slice status

| Slice | Status |
|---|---|
| S0 Foundation | Done (PR #1) |
| S1 Mock connector → sync → dashboard | Done (PR #2) |
| S2 Semantic model + KPIs + goals | Done (PR #3) |
| S3 AI assistant (tool allowlist) | Done (PR #4) |
| S4 Workflows (in-house DAG) | Done (PR #5) |
| S5 Notifications + scheduled workflows | Done (in PR #6 stack) |
| S6 MFA step-up (TOTP) | Done (merged into PR #6 stack) |
| S7 Audit hash-chain + export | Done (PR #8) |
| S8 Platform console | Done (PR #10 to main; prior #9 landed on S7 branch only) |
| S9 OIDC SSO (mock IdP) | Done (this PR to main; prior #11 landed on S8 branch only) |

## S4 exit criteria

- [x] ADR 0006: Temporal vs in-house DAG decision
- [x] `WorkflowDefinition` / `WorkflowRun` / `WorkflowStepRun` / `ApprovalRequest` + RLS
- [x] Step allowlist: `check_goal`, `notify`, `wait_approval`
- [x] Dry-run + `Idempotency-Key` on run start
- [x] Human approval resume path
- [x] Spanish UI `/app/automatizaciones`
- [x] Isolation + engine tests

## S5 exit criteria

- [x] `Notification` model + RLS + `notification:read`
- [x] `notify` step persists in-app notifications (skipped on dry-run)
- [x] Workflow schedule fields + BullMQ job scheduler / inline tick
- [x] Spanish UI `/app/notificaciones` + schedule controls
- [x] Isolation + notification/schedule tests

## S6 exit criteria

- [x] ADR 0007: MFA first; SSO/SCIM deferred
- [x] `UserMfaFactor` + `MfaChallenge` (encrypted TOTP secret)
- [x] Login step-up (`mfaRequired` + `/auth/mfa/verify`)
- [x] Enroll / enable / disable APIs + audit events
- [x] Spanish UI `/app/seguridad` + login MFA step
- [x] Unit + integration MFA tests

## S7 exit criteria

- [x] ADR 0008: per-org audit hash-chain
- [x] `prevHash` / `eventHash` on `AuditEvent` + advisory lock on record
- [x] `GET .../audit-events/verify` + `/export`
- [x] Spanish UI `/app/auditoria`
- [x] Tamper detection + isolation tests

## S8 exit criteria

- [x] ADR 0009: read-only platform console
- [x] `User.isPlatformAdmin` + `/platform/overview|organizations|health`
- [x] Directory metadata only (no tenant payloads)
- [x] Spanish UI `/app/plataforma`
- [x] Deny non-admin + smoke tests

## S9 exit criteria

- [x] ADR 0010: OIDC + mock IdP; SCIM deferred
- [x] `OrganizationSsoConfig` + PKCE start/callback + `UserSsoIdentity`
- [x] Mock authorize issues codes; JIT membership optional
- [x] Spanish UI login SSO + `/app/sso`
- [x] Isolation / login tests
