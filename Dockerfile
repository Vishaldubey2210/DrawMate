# ==========================================
# DrawMate Multi-Stage Production Dockerfile
# ==========================================

# Stage 1: Build Frontend SPA
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
RUN npm ci --workspace=client
COPY client/ ./client/
RUN npm run build:client

# Stage 2: Build Backend Server
FROM node:20-alpine AS server-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --workspace=server
COPY server/ ./server/
RUN npm run build:server

# Stage 3: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --workspace=server --omit=dev

# Copy compiled backend assets
COPY --from=server-builder /app/server/dist ./server/dist
COPY server/package.json ./server/package.json

# Copy compiled frontend assets for static serving
COPY --from=client-builder /app/client/dist ./client/dist

# Security: Switch to non-root node user
USER node

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Expose backend service port
EXPOSE 5000

# Start server
CMD ["node", "server/dist/index.js"]
