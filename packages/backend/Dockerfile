# syntax=docker/dockerfile:1.7
# ============================================================
#  Jitre Backend — NestJS 11 multi-stage build
# ============================================================
# Stage 1: install dev deps + compile the whole monorepo so we
# get @jitre/shared resolved before tsc runs.
# Stage 2: ship a slim runtime with only production dependencies
# and the compiled output.

# ------------------------------------------------------------
# Stage 1 — builder
# ------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /workspace

# Copy root manifests + workspace manifests so npm can resolve
# the workspaces dependency graph in a single install.
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

RUN npm ci --workspaces --include-workspace-root

# Copy sources for the workspaces the backend actually needs.
COPY packages/shared packages/shared
COPY packages/backend packages/backend

# Compile shared first so the backend can resolve its types.
RUN npm run build -w @jitre/shared
RUN npm run build -w @jitre/backend

# ------------------------------------------------------------
# Stage 2 — runtime
# ------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production-only deps to keep the image small.
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
RUN npm ci --omit=dev --workspaces --include-workspace-root

# Bring over the built JS for both workspaces.
COPY --from=builder /workspace/packages/shared/dist packages/shared/dist
COPY --from=builder /workspace/packages/backend/dist packages/backend/dist

# Upload directory for the local storage driver. Bind-mount this
# at runtime if you need persistence across container restarts.
RUN mkdir -p /app/uploads
ENV STORAGE_LOCAL_ROOT=/app/uploads

EXPOSE 3000

# The backend's compiled entrypoint lives at dist/main.js.
CMD ["node", "packages/backend/dist/main.js"]
