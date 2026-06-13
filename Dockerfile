FROM node:20-alpine

# Install dependencies for native modules
RUN apk add --no-cache curl libc6-compat python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies for the production build
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after the build artifact exists
RUN npm prune --omit=dev --no-audit --no-fund

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set permissions
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Production coordination memory hint (completeStartup + auto-start self-heal for bingx-x01)
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Health check (includes engine coordination status)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD sh -c "curl -fsS http://localhost:${PORT:-3001}/api/health/readiness || exit 1"

# Start the application
CMD ["npm", "start"]