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

COPY marktrace/server.js ./
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["npm", "start"]
