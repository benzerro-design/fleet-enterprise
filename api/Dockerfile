# ---------- deps ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- builder ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
  && npm run build \
  && npm prune --omit=dev \
  && rm -rf /root/.npm

# ---------- runner ----------
FROM node:20-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/main.js"]
