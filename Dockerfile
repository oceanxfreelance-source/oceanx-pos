# syntax=docker/dockerfile:1
# Multi-stage build for the OceanX API and web app (one repo, two runtime images).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build -w @oceanx/api && npx -w @oceanx/web vite build

# ---------------------------------------------------------------- API runtime
FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev -w @oceanx/api && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/drizzle apps/api/drizzle
RUN mkdir -p /data/storage && chown node:node /data/storage
USER node
WORKDIR /app/apps/api
ENV STORAGE_DIR=/data/storage PORT=4000 HOST=0.0.0.0
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
# Run migrations as a separate one-off job: `docker compose run --rm api node dist/db/migrate.js`
CMD ["node", "dist/server.js"]

# ---------------------------------------------------------------- Web runtime (static files + /api reverse proxy)
FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
