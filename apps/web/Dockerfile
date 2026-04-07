# --- builder ---
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --workspace=@hope-saude/web --include-workspace-root

COPY apps/web ./apps/web

WORKDIR /workspace/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# --- runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/web/.next ./.next
COPY --from=builder /workspace/apps/web/package.json ./package.json
COPY --from=builder /workspace/apps/web/next.config.js ./next.config.js

USER app
EXPOSE 3001
CMD ["npx", "next", "start", "-p", "3001"]
