## Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (better caching)
COPY package.json package-lock.json ./
RUN npm ci

# Prisma schema/migrations first (so prisma generate can run)
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

# Prisma config exige essas vars, mas o `prisma generate` não precisa conectar no banco.
# Usamos defaults "fake" e permitimos sobrescrever via build-args (ex.: vindo do .env na VM).
ARG DATABASE_URL=postgresql://user:pass@localhost:5432/db?schema=public
ARG DIRECT_URL=postgresql://user:pass@localhost:5432/db?schema=public
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL

RUN npx prisma generate

# Build app
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

## Runtime stage
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Run migrations on startup (requires DATABASE_URL/DIRECT_URL)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

