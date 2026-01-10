# Builder stage - compile TypeScript and build native modules
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage - minimal runtime image
FROM node:20-bookworm-slim

WORKDIR /app

# Install runtime dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install ONLY production dependencies
# This will rebuild better-sqlite3 for the production architecture
RUN npm ci --omit=dev

# Copy built TypeScript output from builder
COPY --from=builder /app/dist ./dist

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 3060

# Start server
CMD ["npm", "start"]
