# Build from the repo root (the workspace lockfile lives there):
#   docker build -f backend/Dockerfile -t taskflow-api:dev .

ARG NODE_IMAGE=node:20.20.2-alpine

# ---- stage 1: build ----


FROM ${NODE_IMAGE} AS build
WORKDIR /app

# Manifests first so the dependency layer is cached until they change.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
# The postinstall script runs `prisma generate`, which needs the schema.
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/
RUN npm ci -w backend --include-workspace-root=false

COPY backend/tsconfig.json backend/tsconfig.build.json backend/
COPY backend/src backend/src
RUN npm run build -w backend

# ---- migrate: one-off job (docker compose target) ----
# Reuses the build stage, which has the Prisma CLI and the migrations folder.
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy", "--schema=backend/prisma/schema.prisma"]

# ---- stage 2: production dependencies only ----
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
# --ignore-scripts: the generated client is copied from the build stage instead.
# npm still installs the prisma CLI as an optional peer of @prisma/client; only the
# migrate stage needs it, so it is deleted here and never reaches the runtime image.
RUN npm ci -w backend --omit=dev --ignore-scripts \
  && rm -rf node_modules/prisma node_modules/@prisma/config node_modules/deepmerge-ts \
  && npm cache clean --force

# ---- stage 3: runtime ----
FROM ${NODE_IMAGE} AS runtime
# Prisma's query engine needs OpenSSL on Alpine.
# npm and yarn are never used at runtime; removing them drops their bundled CVEs.
RUN apk add --no-cache openssl \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
     /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health/live > /dev/null || exit 1

# Exec form: node is PID 1 and receives SIGTERM directly for graceful shutdown.
CMD ["node", "backend/dist/server.js"]
