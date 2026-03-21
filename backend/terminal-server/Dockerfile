# =============================================================================
# Terminal Server Dockerfile
# =============================================================================
# Builds the WebSocket PTY server that bridges browser terminals to Docker
# =============================================================================

FROM node:20-alpine

# Install build dependencies for node-pty
RUN apk add --no-cache python3 make g++ docker-cli

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Expose WebSocket port
EXPOSE 8080

# Run the server
CMD ["node", "dist/index.js"]
