# Architecture — AI Connector

**Status:** Living document for Fase 1 construction  
**Stack ADRs:** [0001](adr/0001-application-stack.md) · [0002](adr/0002-database-and-analytics.md) · [0003](adr/0003-queue-and-workflow-engine.md) · [0004](adr/0004-llm-provider.md) · [0005](adr/0005-locale-and-sync-timezone.md) · [0006](adr/0006-workflow-engine.md) · [0007](adr/0007-mfa-and-enterprise-identity.md) · [0008](adr/0008-audit-hash-chain.md) · [0009](adr/0009-platform-console.md) · [0010](adr/0010-oidc-sso.md) · [0011](adr/0011-scim-provisioning.md) · [0012](adr/0012-org-require-mfa.md)

## Current shape (S11)

Modular monolith:

| Process | Path | Role |
|---|---|---|
| Web | `apps/web` | Next.js UI (Spanish-first + seguridad MFA) |
| API | `apps/api` | NestJS modules through assistant + workflows + notifications + MFA |
| Shared | `packages/shared` | DTOs, permission constants, error codes |
| Postgres | docker-compose / local | OLTP + snapshots + semantic + assistant + workflows + notifications + MFA |
| Redis | docker-compose / local | BullMQ sync + workflow queues (incl. schedules) |

## Domain modules (API)

- `identity` — users, local auth, sessions
- `tenancy` — organizations, companies, memberships, role bindings
- `policy` — permission evaluation against org/company scope
- `audit` — append-only `audit_events`
- `connectors` — mock connector CRUD
- `sync` — BullMQ workers, manual + scheduled (00:00 TZ) sync, snapshots
- `semantic` — semantic model + KPI resolution from snapshots
- `goals` — targets vs KPI actuals
- `dashboards` — freshness panel + KPIs + goals + ETag
- `assistant` — LLM orchestrator (OpenAI/mock), tool allowlist, sanitization
- `workflows` — in-house linear DAG (BullMQ), dry-run, approvals, schedules ([ADR 0006](adr/0006-workflow-engine.md))
- `notifications` — in-app inbox fed by workflow `notify` steps
- `auth` MFA — TOTP enroll + login step-up ([ADR 0007](adr/0007-mfa-and-enterprise-identity.md))

Deferred: real ERP/CRM connectors, full BI editor, Temporal, external IdP wiring / SCIM Groups, consented support access.

## Request path (tenant safety)

1. Authenticate session/JWT.
2. Resolve active `organization_id` (+ optional `company_id`) from server-side session context — never trust bare client IDs.
3. Authorize permission for the route/action.
4. `set_config('app.current_org_id', …)` for RLS.
5. Execute query/command; emit audit event for sensitive mutations.

## Sync path (S1)

1. Manual: `POST .../sync` (+ optional `Idempotency-Key`) → `SyncRun` → queue (or inline in tests).
2. Scheduled: BullMQ job scheduler `0 0 * * *` with `tz` = company or org IANA timezone.
3. Worker loads connection, runs mock extract, writes `DataSnapshot`, updates `lastSyncedAt`.
4. Dashboard freshness = `fresh` | `stale` | `never` from `lastSyncedAt` vs `staleAfterHours`.

## Semantic / goals path (S2)

1. Connection create bootstraps `SemanticModel` + mock `MetricDefinition`s (+ default sales goal).
2. Dashboard read resolves KPIs via `sourcePath` against latest snapshot payload.
3. Active goals compare actual KPI vs `targetValue` (`gte` / `lte`) → En meta / Fuera de meta / Sin dato.

## Assistant path (S3)

1. Feature flag `AI_ENABLED`; provider `AI_PROVIDER=mock|openai` (mock if no `OPENAI_API_KEY`).
2. Sanitize + wrap user text; system prompt forbids instruction override.
3. Tool loop (max 4) over allowlisted read-only tools scoped by `organizationId` + RLS.
4. Persist user/tool/assistant messages; audit `assistant.turn` with tool names only.

## Workflow path (S4)

1. Create definition with allowlisted steps (`check_goal`, `notify`, `wait_approval`).
2. Start run (`dryRun` and/or `Idempotency-Key`) → BullMQ `workflow-runs` (or inline in tests).
3. Engine advances steps; `wait_approval` pauses until human decide; dry-run simulates approval.
4. Audit definition create, run start, approval decisions, run success.

## Notifications + schedules (S5)

1. Real `notify` steps write `Notification` rows (`channel=in_app`); dry-run only marks `simulated`.
2. `POST .../workflows/:id/schedule` enables BullMQ job scheduler (`scheduleCron` + org TZ).
3. Scheduled ticks create non-dry-run runs with `context.trigger=schedule`.
4. Spanish UI `/app/notificaciones` lists/marks read; Automatizaciones toggles schedule.

## MFA path (S6)

1. Authenticated `POST /auth/mfa/setup` → encrypted pending factor + otpauth URL.
2. `POST /auth/mfa/enable` with TOTP code → `enabledAt`.
3. Login with MFA enabled → `{ mfaRequired, mfaToken }` → `POST /auth/mfa/verify` → session.
4. Spanish UI `/app/seguridad` + login MFA step.

## Audit integrity (S7)

1. `AuditService.record` locks per-org tip and writes `prevHash`/`eventHash`.
2. `GET .../audit-events/verify` recomputes the chain; `/export` returns JSON + `chainValid`.
3. Spanish UI `/app/auditoria` lists events and downloads export.

## Platform console (S8)

1. `User.isPlatformAdmin` gates `/platform/*`.
2. Overview + org directory return counts/metadata only (no snapshots/KPIs/messages).
3. Spanish UI `/app/plataforma`; seed user `platform@example.com`.

## SSO path (S9)

1. Org admin enables mock SSO via `PUT /organizations/:id/sso`.
2. Login `GET /auth/sso/start` → mock authorize (PKCE) → `/auth/sso/callback`.
3. JIT may create user + `org_member` binding; links `UserSsoIdentity`.
4. Spanish UI login SSO entry + `/app/sso`.

## SCIM path (S10)

1. Org admin mints bearer token via `POST /organizations/:id/scim/tokens`.
2. IdP calls `/scim/v2/Users` with the token (create/list/patch/delete).
3. Soft delete / `active=false` → membership `suspended`.
4. Spanish UI `/app/scim`.

## Require-MFA path (S11)

1. Admin enables personal TOTP, then `PUT .../security-policy` `{ requireMfa: true }`.
2. Password login without TOTP → `mfa_enrollment_required`.
3. AuthGuard blocks non-MFA routes for password sessions in requireMfa orgs; SSO exempt.

## Non-goals in this codebase stage

- Full BI editor drag/drop, write-capable AI tools / auto-automations, Temporal cluster, live Entra/Google apps + SCIM Groups/Bulk, multi-region DR claims.
