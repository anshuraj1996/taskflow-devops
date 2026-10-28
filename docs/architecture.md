# TaskFlow architecture

## Overview

```
Browser ──► Vite dev server (5173) ──proxy /api, /health──► Express API (4000) ──► PostgreSQL (5432)
            (static SPA in production)                       Prisma ORM
```

- **Frontend**: a React SPA. In development, Vite proxies `/api` and `/health` to the API, so the browser stays same-origin. In production, the built `frontend/dist` is served statically, either behind the same ingress as the API or with `VITE_API_URL` set.
- **Backend**: a stateless Express API, so any number of replicas can run behind a load balancer. All state lives in PostgreSQL. JWTs are self-contained, so no session store is needed.
- **Database**: PostgreSQL. The schema is managed by Prisma migrations in `backend/prisma/migrations` and applied with `prisma migrate deploy`, which is safe to run in CI or an init container.

## Backend structure

`app.ts` builds the Express app with no network listener, so Supertest can drive it in tests. `server.ts` owns the process: it connects to the database (with retries), listens, and handles signals and graceful shutdown.

Request pipeline, in order:

1. `pino-http` assigns a request id (`X-Request-Id`) and logs one line per request. Health probes are excluded.
2. `helmet` sets security headers. `cors` allows the configured origins and exposes `X-Request-Id`.
3. `express.json` parses bodies, capped at 100 kB.
4. `/health/*` handlers run here, so they are not rate limited.
5. `express-rate-limit` applies to `/api`, with a stricter limiter on login and register.
6. `/api/v1/*` module routers. Each handler parses its input with Zod, then calls a service.
7. `notFoundHandler` and then `errorHandler`. Every error is mapped to `{ error: { code, message, details?, requestId } }`:
   - Zod errors → 400
   - Prisma unique-constraint violations (P2002) → 409
   - `AppError` → its own status
   - anything else → 500, with the stack logged and nothing leaked to the client

Each module has the same layout: `*.schemas.ts` (Zod), `*.service.ts` (business logic and Prisma), `*.controller.ts` (HTTP), and `*.routes.ts`.

## Data model

```
users ─┬─< project_members >─┬─ projects ─┬─< tasks ─┬─< task_activities
       │                      │            │          │
       └── owner_id ──────────┘            │          └── assigned_to_id / created_by_id ─► users
                                           └─< task_activities
```

| Table             | Notes                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`           | `email` is unique and stored lower-cased. `role` is `ADMIN`, `MANAGER` or `MEMBER`.                                                                                  |
| `projects`        | `status` is `ACTIVE` or `ARCHIVED`. Archiving is a soft state; tasks in an archived project are read-only.                                                           |
| `project_members` | Replaces the document model's `memberIds[]`. The owner is always a member, so every access check is a single membership lookup.                                      |
| `tasks`           | `status`: TODO → IN_PROGRESS → BLOCKED → DONE. `priority`: LOW … URGENT. Postgres sorts enums in declaration order, so sorting by priority works without extra code. |
| `task_activities` | Append-only feed for the dashboard. `task_id` is set to NULL on delete, so DELETED events survive.                                                                   |

All primary keys are UUIDs and all timestamps are `timestamptz`.

### Indexes and the queries they serve

| Index                                          | Query                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `users(email)` unique                          | Login lookup; duplicate-registration check                                  |
| `project_members(project_id, user_id)` PK      | "Is user X a member of project Y?" (every authorization check)              |
| `project_members(user_id)`                     | "Which projects can user X see?" (project list, task list scope, dashboard) |
| `projects(owner_id)`                           | Projects owned by a user                                                    |
| `projects(status, updated_at DESC)`            | Project list filtered by status, newest first                               |
| `tasks(project_id, status)`                    | Task board, per-project status counts                                       |
| `tasks(project_id, created_at DESC)`           | Default task list ordering within a project                                 |
| `tasks(assigned_to_id, status)`                | "My open tasks", the `assignedTo=me` filter                                 |
| `tasks(due_date, status)`                      | Overdue counts and the `overdue=true` filter                                |
| `task_activities(project_id, created_at DESC)` | Recent activity feed                                                        |

To check these against realistic volumes:

```bash
SEED_TASKS=50000 npm run db:seed -w backend
docker exec -it taskflow-postgres psql -U taskflow -c \
  "EXPLAIN ANALYZE SELECT * FROM tasks WHERE assigned_to_id = '<uuid>' AND status <> 'DONE';"
```

## Authorization

Authorization happens in two layers.

1. **Role gates** (`requireRole`) on routes where only the role matters:
   - Creating projects: ADMIN or MANAGER
   - Listing the user directory: ADMIN or MANAGER
   - Changing a user's role: ADMIN only

2. **Resource-level checks** in services, on every request that takes an ID:
   - **Visibility**: ADMIN sees everything. Everyone else sees only projects they belong to, and tasks inside those projects. Requests for anything else return **404, not 403**, so changing an ID in a URL doesn't reveal whether that resource exists.
   - **Managing a project** (owner or ADMIN): rename, archive or unarchive, replace members, assign tasks to anyone, delete tasks.

| Action                             | Admin | Project owner |    Other project member     | Non-member |
| ---------------------------------- | :---: | :-----------: | :-------------------------: | :--------: |
| View project/tasks                 |   ✓   |       ✓       |              ✓              |    404     |
| Update project / members / archive |   ✓   |       ✓       |             403             |    404     |
| Create task                        |   ✓   |       ✓       |              ✓              |    404     |
| Assign task to someone else        |   ✓   |       ✓       | 403 (self/unassigned only)  |    404     |
| Edit task / change status          |   ✓   |       ✓       | only if assignee or creator |    404     |
| Delete task                        |   ✓   |       ✓       |             403             |    404     |

A MANAGER who doesn't own a project is treated as a regular member of it. The task rules are pure functions in `modules/tasks/tasks.policy.ts`, with their own unit tests.

Other rules:

- Self-registration always creates a MEMBER. Elevated roles are granted by an admin, using `PATCH /users/:id/role`.
- The auth middleware loads the user from the database on each request. Role changes and deleted accounts therefore take effect immediately, not at token expiry.
- Removing a member from a project also unassigns their tasks in it.
- Login runs a bcrypt comparison even when the email is unknown, so response timing doesn't reveal which accounts exist.

## Observability and lifecycle (Kubernetes-ready)

- **Logs**: one JSON object per line on stdout. Each line has `level`, `time`, `service`, `env`, `reqId`, `userId`, `req.method`/`req.url` and `res.statusCode`. Secrets (`authorization`, `password`, `passwordHash`, `token`) are redacted.
- **Liveness** (`/health/live`) never depends on the database.
- **Readiness** (`/health/ready`) pings the database with a timeout. It returns 503 during shutdown, so the pod leaves the Service endpoints before connections close.
- **Graceful shutdown**: on SIGTERM, the server marks itself not-ready, calls `server.close()` to drain in-flight requests, disconnects Prisma, and exits. A force-exit timer (`SHUTDOWN_TIMEOUT_MS`) caps the whole sequence. Set `terminationGracePeriodSeconds` above that value.
- **Startup**: the database connection is retried 10 times, 2 seconds apart, so the pod tolerates the database starting late.

## Frontend structure

- `services/`: a typed `fetch` client (`api.ts`) and the endpoint functions (`taskflow.ts`). A 401 on an authenticated request clears the session.
- `features/auth`: `AuthProvider` restores the session from the stored token through `/users/me`.
- `pages/`: Login, Register, Dashboard, Projects, Project detail (Kanban-style board), and Tasks (filterable, paginated table whose filters live in the URL).
- Server state is handled by TanStack Query. Mutations invalidate the affected queries.
- Styling uses Tailwind CSS v4 through `@tailwindcss/vite`. A few shared primitives (`btn`, `input`, `card`, …) are defined with `@utility` in `src/index.css`.
- The UI mirrors the API's permission rules (for example, it disables controls a user can't use), but the API remains the source of truth.
