# syntax=docker/dockerfile:1.7
# ============================================================
#  Jitre Frontend — Angular 21 multi-stage build
# ============================================================
# Stage 1: build the Angular app inside Node 20.
# Stage 2: serve the static bundle with nginx + reverse-proxy
# /api/v1/* and /ws to the backend container.

# ------------------------------------------------------------
# Stage 1 — builder
# ------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

RUN npm ci --workspaces --include-workspace-root

COPY packages/shared packages/shared
COPY packages/frontend packages/frontend

# Shared first so types resolve when the Angular compiler runs.
RUN npm run build -w @jitre/shared
RUN npm run build -w @jitre/frontend

# ------------------------------------------------------------
# Stage 2 — nginx runtime
# ------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/packages/frontend/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80

# nginx in foreground so docker sees the process state.
CMD ["nginx", "-g", "daemon off;"]
