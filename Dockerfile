# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY marktrace/package.json marktrace/package-lock.json ./
RUN npm ci

COPY marktrace/ ./
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

RUN mkdir -p /data && chown node:node /data

COPY marktrace/package.json marktrace/package-lock.json ./
RUN npm ci --omit=dev

COPY marktrace/server.ts ./
COPY marktrace/server-lib ./server-lib
COPY marktrace/src ./src
COPY marktrace/public ./public
COPY marktrace/tsconfig.json ./
COPY --from=build /app/dist ./dist

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
