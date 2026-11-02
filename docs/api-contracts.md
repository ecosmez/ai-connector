# API contracts — S0

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

## Health

| Method | Path |
|---|---|
| GET | `/health` |

Idempotency-Key and ETag conventions land with S1 mutating sync/BI routes.
