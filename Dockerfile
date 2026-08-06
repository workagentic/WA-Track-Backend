# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .npmrc ./
# Cache mount persists node_modules downloads across builds (and across the
# builder/runner stages' separate `npm ci` calls below) even though the
# layer cache itself gets invalidated by lockfile changes - avoids
# re-fetching the same packages from scratch every time on a slow link.
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json .npmrc ./
# full install (not --omit=dev): migration:run uses the ts-node-based TypeORM CLI against
# src/database/migrations/*.ts, so ts-node/typescript/tsconfig-paths must be present at
# runtime. --include=dev makes that explicit regardless of NODE_ENV - npm otherwise
# treats NODE_ENV=production as an implicit --omit=dev and silently skips them.
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev
# Set only after the install, so it governs the app's runtime behavior
# without affecting what npm ci decides to install above.
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY tsconfig.json tsconfig.build.json ./

EXPOSE 3000
CMD ["node", "dist/main"]
