FROM node:20-alpine AS build

RUN apk add --no-cache python3 make g++ docker-cli

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runtime

RUN apk add --no-cache python3 make g++ docker-cli

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/index.js"]
