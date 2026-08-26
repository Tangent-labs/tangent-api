# Tangent API

Backend API for the Tangent protocol. It serves protocol metrics (TVL, APRs, prices, revenues, volumes, positions), user-facing programs (points, referrals, predeposits), a risk-monitoring feed (REST + WebSocket), and admin-managed content (feature banners) to the Tangent dApp and other consumers.

Built with [Fastify](https://fastify.dev/) and TypeScript, backed by PostgreSQL via [Prisma](https://www.prisma.io/) using a schema shared across Tangent services ([`@tangent/prisma-schema-shared`](https://github.com/Tangent-labs/prisma-schema-shared)).

## Table of contents

- [Architecture](#architecture)
- [Project layout](#project-layout)
- [API surface](#api-surface)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Testing, linting, formatting](#testing-linting-formatting)
- [Build & run](#build--run)

## Architecture

The service follows a simple layered architecture, repeated per domain (`points`, `referral`, `predeposit`, `protocol_metrics`, `user`, `monitoring`, `feature_banner`):

```
routes/    Fastify route registration, request/response wiring
  │        (schemas/ hold the JSON Schema )
  ▼
services/  Business logic
  ▼
data/      Repositories — the only layer that talks to Prisma/Postgres
```

`src/index.ts` is the root: it builds the Fastify instance, instantiates one repository → service pair per domain ( Singleton ), and wires each service into its route module.

**Plugins** (`src/plugins/`)

- `prisma.ts` decorates the Fastify instance with a shared `PrismaClient`, disconnects on shutdown.
- `cache.ts` in-memory LRU caches (`shortCache` / `longCache`) with helpers by routes to cache expensive on-chain/DB reads.
- `websocket.ts` registers `@fastify/websocket` support.
- `monitoring-ws.ts` a `/monitoring/ws` endpoint that periodically (every 60s) computes the monitoring snapshot and broadcasts it to connected clients, with per-IP and global connection caps.

**Cross-cutting concerns**

- **Auth**: `src/middleware/auth.ts` exposes `secretTokenPreHandler`, a bearer-token pre-handler used to protect admin/internal routes (`SECRET_TOKEN` env var).
- **Rate limiting**: global IP-based rate limit (100 req/min) via `@fastify/rate-limit`.
- **CORS**: open by default (`origin: true`), configured in `src/index.ts`.
- **Caching**: route-level in-memory caching (LRU, TTL-based) rather than a distributed cache — suitable for a single-instance deployment.

### API documentation

The API self-documents via OpenAPI/Swagger, generated from the route schemas (`@fastify/swagger` + `@fastify/swagger-ui`). See [`api.tangent.finance/docs`](api.tangent.finance/docs)

This is the source of truth for request/response shapes — see [`src/schemas/`](src/schemas) for the schema definitions backing each route.

## Project layout

```
src/
  index.ts                  Composition root: plugin registration, DI wiring, server start
  types.ts                  Shared route/DTO types
  utils.ts                  Shared helpers (error normalization, etc.)
  middleware/
    auth.ts                 Bearer-token pre-handler for protected routes
  plugins/
    prisma.ts               PrismaClient decorator
    cache.ts                In-memory LRU cache decorators
    websocket.ts            @fastify/websocket registration
    monitoring-ws.ts        Monitoring broadcast over WebSocket
  routes/                  Fastify route registration per domain
  schemas/                 JSON Schema (OpenAPI) contracts per domain
  services/                Business logic per domain
    monitoring/              Monitoring-specific submodules (filters, thresholds, status, types)
  data/                    Prisma-backed repositories per domain
  scripts/                 One-off / mock data scripts (see Scripts below)
test/                      Vitest unit tests
```

## API surface

Full request/response schemas: see [`docs`](api.tangent.finance/docs) (Swagger UI) once the server is running, or browse [`src/schemas/`](src/schemas).

## Getting started

### Prerequisites

- Node.js
- A PostgreSQL database matching the [`@tangent/prisma-schema-shared`](https://github.com/Tangent-labs/prisma-schema-shared) schema

### Setup

```bash
npm install
cp .env-example .env
npm run prisma:generate # generates prisma types
npm run db:push         # create
npm run dev             # starts the API on http://localhost:3100 with hot reload (tsx)
```

Once running, Swagger UI is available at `http://localhost:3100/docs`.

## Configuration

Configuration is provided via environment variables (see [`.env-example`](.env-example) for the full list with defaults):

- `DATABASE_URL` — PostgreSQL connection string
- `SECRET_TOKEN` — bearer token required on routes
- `RPC_URL` — Ethereum RPC endpoint used for on-chain verification (e.g. predeposit signatures)
- `MONITORING_*` — thresholds for the risk-monitoring module (collateralization ratio, liquidation distance, peg deviation, price variation, oracle sanity, debt utilization, TVL variation); all optional with sensible defaults, exposed at runtime via `GET /monitoring/thresholds`

## Testing, linting, formatting

```bash
npm test            # run the Vitest suite (test/**/*.test.ts)
npm run lint        # ESLint over src/
npm run typecheck   # tsc --noEmit
npm run format      # Prettier write
npm run format:check
```

## Build & run

```bash
npm run build   # esbuild: transpiles src/**/*.ts to dist/, unbundled, with sourcemaps
npm start        # node dist/index.js
```

The server listens on `0.0.0.0:3100` and shuts down gracefully (closing the Fastify instance, which disconnects Prisma and cleans up the monitoring WebSocket).
