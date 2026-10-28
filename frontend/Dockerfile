# Build from the repo root (the workspace lockfile lives there):
#   docker build -f frontend/Dockerfile -t taskflow-web:dev .

# ---- stage 1: build ----
FROM node:20.20.2-alpine AS build
WORKDIR /app

# Manifests first so the dependency layer is cached until they change.
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
RUN npm ci -w frontend --include-workspace-root=false

COPY frontend frontend
RUN npm run build -w frontend

# ---- stage 2: runtime ----
# Unprivileged variant runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1
