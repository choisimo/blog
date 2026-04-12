# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app/backend

# better-sqlite3 requires native build toolchain on Alpine
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY backend/package.json backend/package-lock.json ./
COPY shared ../shared
RUN npm ci --omit=dev

# Copy source
COPY backend/src ./src

ENV NODE_ENV=production
EXPOSE 5080
CMD ["node", "src/index.js"]
