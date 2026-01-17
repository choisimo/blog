# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

# better-sqlite3 requires native build toolchain on Alpine
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source
COPY src ./src

ENV NODE_ENV=production
EXPOSE 5080
CMD ["node", "src/index.js"]
