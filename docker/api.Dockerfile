# Orbit Support API — multi-stage build from the npm workspace (PH-8.3). Nothing here is a release: the
# release itself needs the Owner's authorization (GOVERNANCE.md §1.1, docs/runbooks/RELEASE.md).
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json .nvmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @orbit-support/shared && npm run build --workspace api \
  && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /src/package.json /src/package-lock.json ./
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /src/packages/shared/dist ./packages/shared/dist
COPY --from=build /src/apps/api/package.json ./apps/api/package.json
COPY --from=build /src/apps/api/dist ./apps/api/dist
COPY --from=build /src/apps/api/drizzle ./apps/api/drizzle
# Uploads live on a volume (SUPPORT_UPLOADS_DIR); the database is the PostgreSQL service (SUPPORT_DATABASE_URL).
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
