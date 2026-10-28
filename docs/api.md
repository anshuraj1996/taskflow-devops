# TaskFlow API reference (v1)

Base URL: `http://localhost:4000`. All `/api/v1` endpoints except register and login require:

```
Authorization: Bearer <accessToken>
```

## Conventions

- Request and response bodies are JSON. Timestamps are ISO-8601 in UTC.
- IDs are UUIDs. A malformed ID returns `400 VALIDATION_ERROR`.
- **Errors** always have this shape:

  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Request validation failed",
      "details": [{ "path": "email", "message": "Invalid email" }],
      "requestId": "6a1f…"
    }
  }
  ```

  | Status | Code(s)                                        |
  | ------ | ---------------------------------------------- |
  | 400    | `VALIDATION_ERROR`, `BAD_REQUEST`              |
  | 401    | `UNAUTHORIZED`, `INVALID_CREDENTIALS`          |
  | 403    | `FORBIDDEN`                                    |
  | 404    | `NOT_FOUND`, `ROUTE_NOT_FOUND`                 |
  | 409    | `CONFLICT` (duplicate email, archived project) |
  | 413    | `PAYLOAD_TOO_LARGE`                            |
  | 429    | `RATE_LIMITED`                                 |
  | 500    | `INTERNAL_ERROR`                               |

- **Pagination**: list endpoints accept `page` (default 1) and `limit` (default 20, max 100). They respond with:

  ```json
  { "data": [ … ], "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }
  ```

- Every response includes an `X-Request-Id` header.

---

## Auth

### `POST /api/v1/auth/register`

```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "Password123" }
```

The password must be 8–72 characters and include a letter and a number. New accounts are always created with the `MEMBER` role; any `role` field in the body is ignored.

`201` → `{ "user": User, "accessToken": "…" }` · `409` if the email is already registered

### `POST /api/v1/auth/login`

```json
{ "email": "ada@example.com", "password": "Password123" }
```

`200` → `{ "user": User, "accessToken": "…" }` · `401 INVALID_CREDENTIALS`

### `POST /api/v1/auth/logout`

`204`. Tokens are stateless; the client discards its token.

```bash
TOKEN=$(curl -s -X POST localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"manager@taskflow.dev","password":"Password123"}' | jq -r .accessToken)
```

## Users

| Method | Path                                  | Who            | Description                                                        |
| ------ | ------------------------------------- | -------------- | ------------------------------------------------------------------ |
| GET    | `/api/v1/users/me`                    | any            | `{ user }`                                                         |
| GET    | `/api/v1/users?q=&role=&page=&limit=` | admin, manager | Paginated user directory (used to choose project members)          |
| PATCH  | `/api/v1/users/:id/role`              | admin          | Body `{ "role": "MANAGER" }`. Admins cannot change their own role. |

`User` = `{ id, name, email, role, createdAt, updatedAt }`. `passwordHash` is never returned.

## Projects

### `POST /api/v1/projects` (admin or manager)

```json
{ "name": "Website Redesign", "description": "…", "memberIds": ["<uuid>", "…"] }
```

The caller becomes the owner and is always added as a member. `201` → `{ project }`

### `GET /api/v1/projects?status=ACTIVE|ARCHIVED&q=&page=&limit=`

Returns the projects visible to the caller (an admin sees all), sorted by `updatedAt` descending. Each item includes `owner` and `_count: { tasks, members }`.

### `GET /api/v1/projects/:id`

```json
{
  "project": {
    "id": "…",
    "name": "…",
    "description": "…",
    "status": "ACTIVE",
    "ownerId": "…",
    "owner": { "id": "…", "name": "…", "email": "…" },
    "members": [{ "id": "…", "name": "…", "email": "…", "role": "MEMBER", "joinedAt": "…" }],
    "taskCounts": { "TODO": 4, "IN_PROGRESS": 2 },
    "canManage": true
  }
}
```

Returns `404` if the project doesn't exist or the caller can't see it.

### `PATCH /api/v1/projects/:id` (project owner or admin)

Any subset of `{ name, description, status, memberIds }`:

- `status: "ARCHIVED"` archives the project. `"ACTIVE"` restores it.
- `memberIds` **replaces** the member list. The owner is always kept. Tasks assigned to removed members become unassigned.

### `POST /api/v1/projects/:id/tasks`

```json
{
  "title": "Implement login",
  "description": "…",
  "status": "TODO",
  "priority": "HIGH",
  "dueDate": "2026-11-30T23:59:59.000Z",
  "assignedToId": "<uuid> | null"
}
```

Only `title` is required. Defaults: `status: TODO`, `priority: MEDIUM`.

- The assignee must be a member of the project.
- Members who don't manage the project can assign tasks only to themselves.
- Returns `409` if the project is archived.

`201` → `{ task }`

## Tasks

`Task` = `{ id, title, description, projectId, status, priority, dueDate, assignedToId, createdById, createdAt, updatedAt, assignedTo, createdBy, project: { id, name, status } }`

### `GET /api/v1/tasks`

| Query           | Example                                               | Notes                                                             |
| --------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `projectId`     | `<uuid>`                                              |                                                                   |
| `status`        | `TODO,IN_PROGRESS`                                    | Comma-separated or repeated                                       |
| `priority`      | `HIGH,URGENT`                                         | Comma-separated or repeated                                       |
| `assignedTo`    | `me` \| `unassigned` \| `<uuid>`                      |                                                                   |
| `overdue`       | `true` \| `false`                                     | Overdue means a past due date and status other than DONE          |
| `q`             | `login`                                               | Case-insensitive title search                                     |
| `sortBy`        | `createdAt` \| `updatedAt` \| `dueDate` \| `priority` | Default `createdAt`                                               |
| `order`         | `asc` \| `desc`                                       | Default `desc`. With `dueDate`, tasks with no due date sort last. |
| `page`, `limit` |                                                       |                                                                   |

Results are always limited to tasks in projects the caller can see.

```bash
curl -s "localhost:4000/api/v1/tasks?assignedTo=me&status=TODO,IN_PROGRESS&sortBy=dueDate&order=asc" \
  -H "Authorization: Bearer $TOKEN"
```

### `GET /api/v1/tasks/:id`

`{ task }`, or `404` if the task doesn't exist or the caller can't see it.

### `PATCH /api/v1/tasks/:id`

Any subset of `{ title, description, status, priority, dueDate, assignedToId }`.

- Allowed for the project owner, an admin, or the task's assignee or creator.
- Reassigning to someone else requires managing the project.
- Every status change, reassignment and field update is recorded in the activity feed.

### `DELETE /api/v1/tasks/:id` (project owner or admin)

`204`. A `DELETED` activity entry is kept.

## Dashboard

### `GET /api/v1/dashboard/summary`

Statistics are limited to the caller's visible projects:

```json
{
  "totals": {
    "projects": 3, "activeProjects": 2, "archivedProjects": 1,
    "tasks": 40, "overdueTasks": 6, "myOpenTasks": 3
  },
  "tasksByStatus":   { "TODO": 10, "IN_PROGRESS": 12, "BLOCKED": 8, "DONE": 10 },
  "tasksByPriority": { "LOW": 10, "MEDIUM": 10, "HIGH": 10, "URGENT": 10 },
  "recentActivity": [
    {
      "id": "…", "action": "STATUS_CHANGED", "details": { "from": "TODO", "to": "DONE" },
      "createdAt": "…", "actor": { … }, "task": { "id": "…", "title": "…" }, "project": { "id": "…", "name": "…" }
    }
  ]
}
```

## Health

| Endpoint            | 200                                                         | 503                                                                                 |
| ------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /health/live`  | `{ "status": "ok", "uptimeSeconds": 42, "timestamp": "…" }` | never (if the process can answer, it is alive)                                      |
| `GET /health/ready` | `{ "status": "ready", "checks": { "database": "up" } }`     | `{ "status": "not_ready", "checks": { "database": "down" } }`, or `"shutting_down"` |
