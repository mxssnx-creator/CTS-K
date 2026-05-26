#!/bin/bash
# Vercel Pre-Build Setup Script
# Prepares the environment and builds the Next.js application.
# This script is called by vercel.json buildCommand.
#
# NOTE: Database migrations are NOT run at build time.
# They run automatically at runtime via instrumentation.ts → completeStartup()
# → initRedis() → runMigrations() on the very first request after deployment.
# This is the correct pattern for an in-process inline Redis implementation.

set -e

echo "[Vercel Build] Starting pre-build setup..."
echo "[Vercel Build] NODE_ENV: $NODE_ENV"
echo "[Vercel Build] Node version: $(node --version)"
echo "[Vercel Build] NPM version: $(npm --version)"

# Step 1: Ensure required directories exist
echo "[Vercel Build] Ensuring data directories..."
mkdir -p data/redis
mkdir -p .next/cache

# Step 3: Build the Next.js app
echo "[Vercel Build] Building Next.js application..."
NODE_OPTIONS='--max-old-space-size=8192' npm run vercel-build

echo "[Vercel Build] ✓ Pre-build setup completed successfully"
echo "[Vercel Build] Build artifacts ready at .next/"
echo "[Vercel Build] Migrations will run automatically on first request via instrumentation.ts"
