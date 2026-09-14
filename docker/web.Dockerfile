# Orbit Support web (Next.js) — multi-stage build from the npm workspace (PH-8.3). The browser reaches the API
# through this server's /api rewrite. Next computes that rewrite at BUILD time (routes-manifest.json), so the API
# address is a build argument, not a runtime variable (Cycle Audit 3): compose passes API_ORIGIN=http://api:3001.
FROM node:24-alpine AS build
ARG API_ORIGIN=http://api:3001
ENV API_ORIGIN=${API_ORIGIN}
WORKDIR /src
COPY package.json package-lock.json .nvmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @orbit-support/shared && npm run build --workspace web \
  && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /src/package.json /src/package-lock.json ./
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /src/packages/shared/dist ./packages/shared/dist
COPY --from=build /src/apps/web/package.json ./apps/web/package.json
COPY --from=build /src/apps/web/next.config.ts ./apps/web/next.config.ts
COPY --from=build /src/apps/web/.next ./apps/web/.next
# The app has no public/ directory; add a COPY here if static files are ever added.
USER node
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "../../node_modules/next/dist/bin/next", "start", "-p", "3000"]
