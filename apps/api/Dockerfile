# --- builder ---
FROM node:20-alpine AS builder
WORKDIR /workspace

# Copia manifestos do monorepo (root + api)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# Instala SOMENTE as deps do workspace api
RUN npm ci --workspace=@hope-saude/api --include-workspace-root

# Copia o código da api e o prisma schema
COPY apps/api ./apps/api

# Gera o Prisma Client e compila
WORKDIR /workspace/apps/api
RUN npx prisma generate
RUN npx nest build

# --- runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Usuário não-root
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/api/dist ./dist
COPY --from=builder /workspace/apps/api/prisma ./prisma
COPY --from=builder /workspace/apps/api/package.json ./package.json

USER app
EXPOSE 3000
CMD ["node", "dist/main.js"]
