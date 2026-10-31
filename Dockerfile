# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

# Install git and essential build tools
RUN apk add --no-cache git

# Copy root configuration and lockfiles
COPY package.json package-lock.json tsconfig.base.json vitest.config.ts ./

# Copy packages source
COPY packages/ ./packages/
COPY fixtures/ ./fixtures/

# Install dependencies and build all packages
RUN npm ci
RUN npm run build

# --- Production Image ---
FROM node:22-alpine AS runner

WORKDIR /app

# SafeToDelete requires git for worktree operations
RUN apk add --no-cache git bash

ENV NODE_ENV=production

# Copy built workspace and node_modules from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Link the CLI binary globally
RUN npm link --workspace=@safetodelete/cli

# Default command
ENTRYPOINT ["safetodelete"]
CMD ["--help"]

