# Production image (portability: run the API anywhere, not only on Vercel).
#   docker build -t muthaker-api .
#   docker run --env-file .env -p 4000:4000 muthaker-api
# Migrations are NOT run here: use `npm run db:deploy` (CI migrate workflow) against DIRECT_URL.

# ── deps: full install (dev deps needed to build) ──
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts && npx prisma generate

# ── build ──
FROM deps AS build
COPY . .
RUN npx prisma generate && npx nest build && npm prune --omit=dev --ignore-scripts

# ── runtime ──
FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
