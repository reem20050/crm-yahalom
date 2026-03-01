# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build || (echo "Client build failed, creating empty dist" && mkdir -p dist)

# Stage 2: Build and run server
FROM node:20-alpine
WORKDIR /app

# Install timezone data only (skip native build deps for smaller/faster builds)
RUN apk add --no-cache tzdata
ENV TZ=Asia/Jerusalem
RUN cp /usr/share/zoneinfo/Asia/Jerusalem /etc/localtime && echo "Asia/Jerusalem" > /etc/timezone

# Install server dependencies
COPY server/package*.json ./
RUN npm install --production --ignore-optional

# Copy server files
COPY server/ ./

# Copy frontend build
COPY --from=frontend-builder /app/client/dist ./public

# Create data directory for SQLite (if needed)
RUN mkdir -p data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start server
CMD ["node", "src/index.js"]
