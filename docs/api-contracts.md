# API contracts — S0 + S1

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
| POST | `/organizations/:orgId/connections` | `connection:manage` | Creates mock connector + default dashboard; schedules daily 00:00 TZ sync |
| GET | `/organizations/:orgId/connections/:id` | `connection:manage` | |
| POST | `/organizations/:orgId/connections/:id/sync` | `connection:manage` | Header `Idempotency-Key` optional; replays same run when key repeats |
| GET | `/organizations/:orgId/sync-runs` | `connection:manage` | Optional `?connectionId=` |
| GET | `/organizations/:orgId/sync-runs/:id` | `connection:manage` | |

## Dashboards (S1)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/:orgId/dashboards` | `dashboard:read` | Includes freshness + latest snapshot payload |
| GET | `/organizations/:orgId/dashboards/:id` | `dashboard:read` | Sends `ETag`; `If-None-Match` → 304 |

## Health

| Method | Path |
|---|---|
| GET | `/health` |
