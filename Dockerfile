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

COPY marktrace/package.json marktrace/package-lock.json ./
RUN npm ci --omit=dev

COPY marktrace/server.ts ./
COPY marktrace/server-lib ./server-lib
COPY marktrace/src ./src
COPY marktrace/public ./public
COPY marktrace/tsconfig.json ./
COPY --from=build /app/dist ./dist

RUN mkdir -p /data

EXPOSE 3000

CMD ["npm", "start"]
