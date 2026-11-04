# API contracts — S0–S8

Base URL: `http://localhost:3001`  
Auth: `Authorization: Bearer <sessionToken>`  
Errors: `{ "statusCode": number, "code": string, "message": string }`

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Bootstrap user (dev/S0); body: email, password, name |
| POST | `/auth/login` | `{ token, user }` or `{ mfaRequired: true, mfaToken, user }` when MFA enabled |
| POST | `/auth/mfa/verify` | Body `{ mfaToken, code }` → session token |
| GET | `/auth/mfa` | Authenticated; `{ enabled, pendingSetup, type }` |
| POST | `/auth/mfa/setup` | Authenticated; returns `{ secret, otpauthUrl }` (pending enable) |
| POST | `/auth/mfa/enable` | Authenticated; body `{ code }` |
| POST | `/auth/mfa/disable` | Authenticated; body `{ password, code }` |
| POST | `/auth/logout` | Revokes session |
| GET | `/auth/me` | Current user + memberships + `mfa` status |


## Tenancy

| Method | Path | Permission |
|---|---|---|
| POST | `/organizations` | authenticated (creates org + owner binding) |
| GET | `/organizations` | list memberships for current user |
| GET | `/organizations/:id` | `organization:read` |
| POST | `/organizations/:orgId/companies` | `company:create` |
| GET | `/organizations/:orgId/companies` | `company:read` |
| POST | `/sessions/context` | switch active org/company (must be member) |

## Audit

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/:orgId/audit-events` | `audit:read` | Newest first |
| GET | `/organizations/:orgId/audit-events/verify` | `audit:read` | Recomputes org hash-chain |
| GET | `/organizations/:orgId/audit-events/export` | `audit:read` | Oldest-first JSON + `chainValid` |

## Connections & sync (S1)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/:orgId/connections` | `connection:manage` | Lists mock connectors in scope |
| POST | `/organizations/:orgId/connections` | `connection:manage` | Creates mock connector + dashboard + semantic model + default goal; schedules daily 00:00 TZ sync |
| GET | `/organizations/:orgId/connections/:id` | `connection:manage` | |
| POST | `/organizations/:orgId/connections/:id/sync` | `connection:manage` | Header `Idempotency-Key` optional; replays same run when key repeats |
| GET | `/organizations/:orgId/sync-runs` | `connection:manage` | Optional `?connectionId=` |
| GET | `/organizations/:orgId/sync-runs/:id` | `connection:manage` | |

## Semantic model (S2)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/:orgId/connections/:id/semantic-model` | `semantic:read` | Model + metric definitions |
| POST | `/organizations/:orgId/connections/:id/semantic-model` | `semantic:manage` | Ensure/bootstrap mock model if missing |

## Goals (S2)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/:orgId/goals` | `goal:read` | Optional `?dashboardId=` |
| POST | `/organizations/:orgId/goals` | `goal:manage` | Body: name, metricKey, targetValue, comparator?, dashboardId? |

## Dashboards (S1 + S2)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/:orgId/dashboards` | `dashboard:read` | Freshness + `kpis` + `goals` + snapshot |
| GET | `/organizations/:orgId/dashboards/:id` | `dashboard:read` | Sends `ETag`; `If-None-Match` → 304 |

## Assistant (S3)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/assistant/status` | authenticated | `{ enabled, mode: mock\|openai }` |
| POST | `/organizations/:orgId/assistant/threads` | `assistant:use` | Create thread |
| GET | `/organizations/:orgId/assistant/threads` | `assistant:use` | List current user's threads |
| GET | `/organizations/:orgId/assistant/threads/:id` | `assistant:use` | Thread + messages |
| POST | `/organizations/:orgId/assistant/threads/:id/messages` | `assistant:use` | User turn → tool loop → assistant reply |

Allowlisted tools (read-only): `list_dashboards`, `get_dashboard_overview`, `list_goals`, `list_semantic_metrics`.

## Workflows (S4)

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/organizations/:orgId/workflows` | `workflow:manage` | Body: name, description?, steps[] (`check_goal`\|`notify`\|`wait_approval`) |
| GET | `/organizations/:orgId/workflows` | `workflow:manage` | |
| POST | `/organizations/:orgId/workflows/:id/runs` | `workflow:manage` | `dryRun?`; header `Idempotency-Key` |
| GET | `/organizations/:orgId/workflow-runs` | `workflow:manage` | |
| GET | `/organizations/:orgId/workflow-runs/:id` | `workflow:manage` | Includes stepRuns + approvals |
| GET | `/organizations/:orgId/approvals` | `workflow:manage` | `?status=pending` |
| POST | `/organizations/:orgId/approvals/:id/decide` | `workflow:manage` | `{ decision: approved\|rejected, note? }` |
| POST | `/organizations/:orgId/workflows/:id/schedule` | `workflow:manage` | `{ enabled, cron?, timezone? }` — BullMQ scheduler |

## Notifications (S5)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/:orgId/notifications` | `notification:read` | `?unreadOnly=true` |
| POST | `/organizations/:orgId/notifications/:id/read` | `notification:read` | Marks `readAt` |

`notify` workflow steps with `channel=in_app` (default) create `Notification` rows; dry-run only simulates.

## Platform (S8)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/platform/overview` | `isPlatformAdmin` | Aggregate counts |
| GET | `/platform/organizations` | `isPlatformAdmin` | Directory metadata + counts |
| GET | `/platform/health` | `isPlatformAdmin` | DB + Redis probe |

## SSO (S9)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET/PUT | `/organizations/:orgId/sso` | read / `organization:manage` | Mock SSO config |
| GET | `/auth/sso/status` | public | `{ enabled, organizationName }` |
| GET | `/auth/sso/start` | public | PKCE start → `{ authorizeUrl }` |
| GET | `/auth/sso/mock/:orgId/authorize` | public | Mock IdP (form / `?email=`) |
| GET | `/auth/sso/callback` | public | Exchanges code; `?format=json` for API |

## Security policy (S11)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET/PUT | `/organizations/:orgId/security-policy` | read / `organization:manage` | `{ requireMfa }` |

## SCIM (S10)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET/POST | `/organizations/:orgId/scim/tokens` | `organization:manage` | List / mint (raw token once) |
| POST | `/organizations/:orgId/scim/tokens/:id/revoke` | `organization:manage` | Revoke |
| GET/POST | `/scim/v2/Users` | SCIM bearer | List / create |
| GET/PUT/PATCH/DELETE | `/scim/v2/Users/:id` | SCIM bearer | Read / replace / patch / soft-delete |

## Health

| Method | Path |
|---|---|
| GET | `/health` |
