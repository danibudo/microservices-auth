# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first to leverage layer caching
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Reinstall production-only dependencies and compile native modules
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev --ignore-scripts && \
    npm rebuild bcrypt --build-from-source

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Migration files must be present at runtime
COPY db/ ./db/
COPY package.json ./
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]