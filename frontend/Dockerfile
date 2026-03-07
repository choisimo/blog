# =============================================================================
# Frontend Dockerfile - Multi-stage build for production
# =============================================================================
# Build Args:
#   - VITE_API_BASE_URL: API endpoint URL (default: https://blog-test.nodove.com)
#   - VITE_SITE_BASE_URL: Site base URL for SEO (default: https://blog-test.nodove.com)
#
# Usage:
#   docker build --build-arg VITE_API_BASE_URL=https://blog-test.nodove.com -t blog-frontend .
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for environment variables
ARG VITE_API_BASE_URL=https://blog-test.nodove.com
ARG VITE_SITE_BASE_URL=https://blog-test.nodove.com

# Set environment variables for build
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SITE_BASE_URL=${VITE_SITE_BASE_URL}

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
