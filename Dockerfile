# syntax=docker/dockerfile:1

# ---- build: install everything, build the page (dist/) and the server (dist-server/) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: production dependencies only, runs as the unprivileged "node" user ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# Time zone data, so TZ (e.g. Europe/Warsaw) works for the daily budget reset.
RUN apk add --no-cache tzdata
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" > /dev/null || exit 1
CMD ["node", "dist-server/index.js"]
