# Multi-stage Dockerfile for Revenue Guardian
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 1. Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# 2. Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# 3. Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy runtime files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "start"]

