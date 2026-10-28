# TaskFlow — Team Task Management System

A small, production-style application that serves as the workload for the DevOps platform built in later phases (CI/CD, Docker, Kubernetes, monitoring, scaling, failure recovery).

Users sign in, create projects, assign tasks to teammates, move tasks through a workflow, and view project statistics.

| Layer        | Technology                                                      |
| ------------ | --------------------------------------------------------------- |
| Frontend     | React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query |
| Backend      | Node.js 20 + Express 5 + TypeScript                             |
| Database     | PostgreSQL 16 (Prisma ORM + migrations)                         |
| Auth         | JWT (HS256) + bcrypt password hashing                           |
| Validation   | Zod                                                             |
| Logging      | Pino (structured JSON, request IDs)                             |
| Testing      | Jest + Supertest (API), Vitest + React Testing Library (UI)     |
| Code quality | ESLint + Prettier                                               |

> **Deviation from the original Phase 1 plan:** PostgreSQL is used instead of MongoDB. The document-style `memberIds: [ObjectId]` array is modelled as a `project_members` join table. See [docs/architecture.md](docs/architecture.md).

## Repository layout

```
taskflow-platform/
├── backend/            Express API (src/app.ts builds the app, src/server.ts owns the process lifecycle)
│   ├── Dockerfile      multi-stage: build → migrate (one-off job) → prod-deps → runtime
│   ├── prisma/         schema.prisma, migrations, seed script
│   ├── src/
│   │   ├── config/     env validation, Prisma client + connection lifecycle
│   │   ├── middleware/ auth, error handling, request IDs, logging, rate limiting
│   │   ├── models/     shared Prisma selects/includes and enums
│   │   ├── modules/    auth, users, projects, tasks, dashboard, health
│   │   ├── routes/     /api/v1 router
│   │   └── utils/
│   └── tests/          unit/ and integration/ (real Postgres test database)
├── frontend/           React SPA
│   ├── Dockerfile      Vite build → nginx-unprivileged (:8080)
│   ├── nginx.conf      static files, SPA fallback, /api + /health proxy to the api service
│   └── src/            components/, features/, hooks/, pages/, services/
├── docs/               architecture.md, api.md
├── scripts/            init-test-db.sql (runs on first Postgres start)
├── docker-compose.yml  full stack: postgres → migrate → api → web
├── .dockerignore       keeps node_modules, dist and .env files out of images
└── package.json        npm workspaces + root scripts
```

## Prerequisites

- **Node.js 20** (`.nvmrc` is provided — `nvm use` / `fnm use`)
- **npm 10+**
- **Docker** (for the local PostgreSQL container) — or any PostgreSQL 14+ you point `DATABASE_URL` at

## Local setup

```bash
# 1. Install dependencies for both workspaces (also generates the Prisma client)
npm install

# 2. Configure environment
cp .env.example .env                      # docker-compose values (optional; defaults work)
cp backend/.env.example backend/.env      # then set a real JWT_SECRET (see below)
cp frontend/.env.example frontend/.env    # optional; defaults work

# Generate a JWT secret and paste it into backend/.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Start PostgreSQL (creates the `taskflow` and `taskflow_test` databases)
npm run db:up

# 4. Apply migrations and load sample data
npm run db:deploy -w backend
npm run db:seed -w backend

# 5. Run API (http://localhost:4000) and web app (http://localhost:5173)
npm run dev
```

Open http://localhost:5173 and sign in with one of the seeded accounts.

### Sample accounts

All seeded accounts use the password **`Password123`**.

| Email                | Role    | Notes                                            |
| -------------------- | ------- | ------------------------------------------------ |
| admin@taskflow.dev   | Admin   | Sees and manages everything                      |
| manager@taskflow.dev | Manager | Owns “Website Redesign”                          |
| nina@taskflow.dev    | Manager | Owns “Mobile App v2”                             |
| member@taskflow.dev  | Member  | Member of “Website Redesign”                     |
| leo@taskflow.dev     | Member  | Member of “Website Redesign” and “Mobile App v2” |

Generate a larger data set for index/query-plan checks with `SEED_TASKS=20000 npm run db:seed -w backend`.

## Run the full stack with Docker Compose

Builds the images and starts PostgreSQL, a one-off migration job, the API and the nginx-served frontend.

```bash
cp .env.example .env
# Set JWT_SECRET in .env (Compose refuses to start without it)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

docker compose up -d --build
docker compose ps -a      # migrate: Exited (0); postgres, api, web: healthy
```

Open http://localhost:8080. Load the sample accounts once with `npm run db:seed -w backend` (from the host, using `backend/.env`).

| Service    | Image / build                          | Port | Notes                                      |
| ---------- | -------------------------------------- | ---- | ------------------------------------------ |
| `postgres` | `postgres:16-alpine`                   | 5432 | Data in the `taskflow-pgdata` named volume |
| `migrate`  | `backend/Dockerfile`, target `migrate` | —    | Runs `prisma migrate deploy`, then exits   |
| `api`      | `backend/Dockerfile` (runtime)         | 4000 | Non-root, `HEALTHCHECK` on `/health/live`  |
| `web`      | `frontend/Dockerfile`                  | 8080 | Proxies `/api` and `/health` to `api:4000` |

Images can also be built on their own, always from the repository root:

```bash
docker build -f backend/Dockerfile  -t taskflow-api:dev .
docker build -f frontend/Dockerfile -t taskflow-web:dev .
```

`docker compose down` stops everything and keeps the data; `docker compose down -v` also deletes the database volume.

## Scripts

Run from the repository root:

| Command                     | Description                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| `npm run dev`               | API (tsx watch) + Vite dev server together                       |
| `npm run build`             | Compile the API to `backend/dist` and the SPA to `frontend/dist` |
| `npm test`                  | All backend and frontend tests                                   |
| `npm run lint`              | ESLint in both workspaces                                        |
| `npm run typecheck`         | TypeScript in both workspaces                                    |
| `npm run format`            | Prettier write                                                   |
| `npm run db:up` / `db:down` | Start local PostgreSQL / stop all Compose services               |

Backend-only (`-w backend`): `db:migrate` (create a migration in dev), `db:deploy` (apply migrations), `db:reset`, `db:seed`, `test:unit`, `test:integration`, `test:coverage`, `start` (run the compiled build).

## Environment variables

### Backend (`backend/.env`)

| Variable               | Default                  | Description                                                                         |
| ---------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| `NODE_ENV`             | `development`            | `development` \| `test` \| `production`                                             |
| `PORT`                 | `4000`                   | HTTP port                                                                           |
| `LOG_LEVEL`            | `info`                   | Pino level (`fatal`…`trace`, `silent`). Pretty output outside production            |
| `DATABASE_URL`         | — (required)             | PostgreSQL connection string                                                        |
| `TEST_DATABASE_URL`    | `…/taskflow_test`        | Used only by the test suite; must contain “test” in the DB name                     |
| `JWT_SECRET`           | — (required, ≥ 32 chars) | HMAC secret for access tokens                                                       |
| `JWT_EXPIRES_IN`       | `1h`                     | Access token lifetime                                                               |
| `BCRYPT_SALT_ROUNDS`   | `12`                     | bcrypt cost factor                                                                  |
| `CORS_ORIGIN`          | `http://localhost:5173`  | Comma-separated allowed browser origins                                             |
| `TRUST_PROXY`          | `0`                      | Number of reverse proxies in front of the API (affects client IP for rate limiting) |
| `RATE_LIMIT_WINDOW_MS` | `900000`                 | Rate-limit window (15 min)                                                          |
| `RATE_LIMIT_MAX`       | `300`                    | Requests per window per IP on `/api`                                                |
| `AUTH_RATE_LIMIT_MAX`  | `20`                     | Requests per window per IP on `/api/v1/auth/login                                   | register` |
| `SHUTDOWN_TIMEOUT_MS`  | `10000`                  | Force-exit deadline during graceful shutdown                                        |
| `DB_READY_TIMEOUT_MS`  | `2000`                   | Readiness probe DB ping timeout                                                     |

The API validates all variables at startup and exits with a clear message if any are missing or invalid.

### Frontend (`frontend/.env`)

| Variable            | Default                 | Description                                                       |
| ------------------- | ----------------------- | ----------------------------------------------------------------- |
| `VITE_API_URL`      | _(empty)_               | API origin baked into the build. Empty = same origin (`/api/...`) |
| `VITE_PROXY_TARGET` | `http://localhost:4000` | Dev server proxy target for `/api` and `/health`                  |

## Testing

```bash
npm test                          # everything
npm run test:unit -w backend      # pure unit tests, no database needed
npm run test:integration -w backend
npm test -w frontend
```

Integration tests run the real Express app via Supertest against the `taskflow_test` database (migrations are applied automatically before the suite). Tables are cleared between tests, so suites run serially (`--runInBand`).

> **Docker Desktop note:** the init script sets `synchronous_commit = off` on `taskflow_test`. Without it, every commit waits on a slow fsync through the Docker Desktop volume and the suite can time out. If your volume was created before this script existed, run:
> `docker exec taskflow-postgres psql -U taskflow -c "ALTER DATABASE taskflow_test SET synchronous_commit = off;"`

## Operational endpoints

| Endpoint            | Purpose                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health/live`  | Liveness — process is up. Never touches the database (a DB outage must not restart pods).                                             |
| `GET /health/ready` | Readiness — 200 when the DB answers `SELECT 1` within `DB_READY_TIMEOUT_MS`; 503 when the DB is down or the process is shutting down. |

Every response carries an `X-Request-Id` header (an incoming one is reused if well-formed). The same id appears in each log line and in error bodies.

On `SIGTERM`/`SIGINT` the server marks itself not-ready, stops accepting connections, drains in-flight requests, disconnects Prisma, and exits. If that takes longer than `SHUTDOWN_TIMEOUT_MS`, it force-exits.

## Further documentation

- [docs/api.md](docs/api.md) — endpoint reference with examples
- [docs/architecture.md](docs/architecture.md) — design, data model, authorization rules, indexes
