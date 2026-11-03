# API contracts — S0–S4

Base URL: `http://localhost:3001`  
Auth: `Authorization: Bearer <sessionToken>`  
Errors: `{ "statusCode": number, "code": string, "message": string }`

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Bootstrap user (dev/S0); body: email, password, name |
| POST | `/auth/login` | Returns `{ token, user }` |
| POST | `/auth/logout` | Revokes session |
| GET | `/auth/me` | Current user + memberships |

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

| Method | Path | Permission |
|---|---|---|
| GET | `/organizations/:orgId/audit-events` | `audit:read` |

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

## Health

| Method | Path |
|---|---|
| GET | `/health` |
