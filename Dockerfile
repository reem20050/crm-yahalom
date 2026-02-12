# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build and run server
FROM node:20-alpine
WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install server dependencies
COPY server/package*.json ./
RUN npm install --production

# Copy server files
COPY server/ ./

# Copy frontend build
COPY --from=frontend-builder /app/client/dist ./public

# Create data directory for SQLite
RUN mkdir -p data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/auth/me || exit 1

# Start server
CMD ["node", "src/index.js"]
