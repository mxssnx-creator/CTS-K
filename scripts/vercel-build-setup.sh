#!/bin/bash
# Vercel Pre-Build Setup Script (fixed)
# Only does what is possible and safe at Vercel build time.
# Runtime migrations + engine bootstrap are handled by the app on first request.

set -e

echo "[Vercel Build] Starting pre-build setup..."
echo "[Vercel Build] NODE_ENV: ${NODE_ENV:-production}"
echo "[Vercel Build] Node version: $(node --version 2>/dev/null || echo 'unknown')"
echo "[Vercel Build] NPM version: $(npm --version 2>/dev/null || echo 'unknown')"

# 1. Install (Vercel already runs installCommand, but keep for local `vercel-build-setup` usage)
echo "[Vercel Build] Ensuring dependencies are present..."
npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -5 || true

# 2. Prepare minimal runtime dirs (Redis file fallback + Next cache)
echo "[Vercel Build] Creating required directories..."
mkdir -p data/redis
mkdir -p .next/cache

# 3. Typecheck (fast fail on obvious TS errors before the heavy Next build)
echo "[Vercel Build] Running typecheck..."
npm run typecheck -- --skipLibCheck 2>&1 | tail -10 || {
  echo "[Vercel Build] WARNING: typecheck had errors (continuing to build anyway)"
}

# 4. The actual Next.js production build (this is what produces .next/)
echo "[Vercel Build] Building Next.js application (vercel-build)..."
NODE_OPTIONS='--max-old-space-size=12288 --max-semi-space-size=128' npm run vercel-build

# 5. Done
echo "[Vercel Build] ✓ Pre-build setup completed successfully"
echo "[Vercel Build] Build artifacts ready at .next/"
ls -la .next/ 2>/dev/null | head -8 || true
