# AI Connector

SaaS multi-tenant de inteligencia de negocios y automatización (Fase 1 en construcción).

## Estado

**S2** — modelo semántico, KPIs desde snapshots, metas con progreso en Análisis.  
S0–S1 (identidad, sync mock, frescura) ya fusionados.

Decisiones aceptadas: ver `docs/adr/`.

## Stack

- TypeScript monorepo (pnpm)
- `apps/web` — Next.js
- `apps/api` — NestJS + Prisma + PostgreSQL
- Redis + BullMQ — cola `connection-sync`

## Desarrollo local

```bash
cp .env.example .env
docker compose up -d   # o Postgres/Redis locales
pnpm install
pnpm --filter @ai-connector/shared build
pnpm db:generate
pnpm --filter @ai-connector/api exec prisma migrate deploy
pnpm db:seed
pnpm --filter @ai-connector/api dev
pnpm --filter @ai-connector/web dev
```

API: `http://localhost:3001` · Web: `http://localhost:3000`

Usuarios seed: `alice@example.com` / `bob@example.com` — contraseña `Password123!`

## Pruebas

```bash
export DATABASE_URL=postgresql://aiconn:aiconn@localhost:5432/aiconnector_test?schema=public
pnpm --filter @ai-connector/api exec prisma migrate deploy
pnpm test
```

## Documentación

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [API contracts](docs/api-contracts.md)
- [Security model](docs/security-model.md)
- [Implementation plan](docs/implementation-plan.md)
