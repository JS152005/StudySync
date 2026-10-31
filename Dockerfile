# ==============================================================================
# STUDYSYNC MULTI-STAGE PRODUCTION DOCKERFILE
# Architecture: Node.js 22 LTS Alpine with Native SQLite & Built Frontend
# ==============================================================================

# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Install build essentials if needed for native modules
RUN apk add --no-cache python3 make g++

# Install root dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Install client dependencies
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

# Copy full source tree
COPY . .

# Build frontend and compile backend TypeScript
RUN npm run build

# Prune devDependencies for production
RUN npm prune --production

# ==============================================================================
# Stage 2: Production Runner
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for reliable container health checking
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=./data/studysync.db

# Create persistent storage directories
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app/data /app/uploads

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy compiled backend and frontend distributions
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

# Expose HTTP port
EXPOSE 3000

# Container healthcheck against /api/health
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Run as non-root node user for container security
USER node

# Start production server
CMD ["node", "dist/index.js"]
