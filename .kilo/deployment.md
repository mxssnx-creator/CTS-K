# Kilo.ai Deployment Guide - CTS Trading Engine

## Overview
This guide explains how to deploy the Crypto Trading System (CTS) with **working production coordination** inside Kilo.ai environments.

The coordination system (instrumentation.ts → completeStartup → trade-engine-auto-start self-healing for `bingx-x01`) has been verified to work in both Dev and Production Mode, including real live order creation + control orders (SL/TP) on BingX.

## Kilo.ai Specific Setup

### 1. Project Configuration
- `kilo.json` is present in `.kilo/kilo.json`
- Default agent: `code`
- Instructions include this deployment guide

### 2. Environment Variables Required (Production Coordination)
```bash
NODE_ENV=production
BINGX_API_KEY=...          # Real credentials (from base-connection-credentials)
BINGX_API_SECRET=...
DATABASE_URL=...
REDIS_URL=...              # or use internal Redis in Kilo worktree
PORT=3001
```

### 3. Startup Flow in Kilo.ai
Kilo runs agents in Node.js environments. The trading engine uses:

- `instrumentation.ts` (runs on cold start)
- `lib/startup-coordinator.ts` → `completeStartup()`
- `lib/trade-engine-auto-start.ts` (self-heals `bingx-x01`)

This is **identical** to the Vercel/Docker production path that was tested.

### 4. Recommended Kilo Worktree Setup
```bash
# When creating a worktree for this trading system
.kilo/setup-script.sh (example):
#!/bin/bash
cp .env.example .env.local
# Inject Kilo-specific Redis/Database if needed
echo "KILO_WORKTREE=true" >> .env.local
```

### 5. Running in Kilo
- Use the standard `npm run start` (updated to 4096MB)
- The engine will auto-initialize via instrumentation
- `bingx-x01` will self-heal and start for live trading

### 6. Production Coordination Guarantees (Kilo Compatible)
- Real live orders + control orders (SL/TP lifecycle) — verified
- Minimal volume policy (`live_volume_factor=0.1`)
- Self-healing after restarts/redeploys
- No debug mode leakage in production
- 22 migrations + database consistency on boot

## Differences from Vercel/Docker
- Kilo worktrees are ephemeral by default — use persistent storage for Redis snapshot if heavy historic data is needed.
- Use Kilo's built-in Redis when available for coordination state.
- Memory is managed by the Kilo runtime (recommend requesting at least 4GB for full engine + historic processing).

## Verification After Deploy in Kilo
1. Check logs for:
   - `[v0] [Startup] ✓ Pre-startup sequence complete`
   - `[v0] [AutoStart] Self-heal: resurrected trade_engine:global=running`
2. Hit `/api/trade-engine/status` — should show `bingx-x01` engine active.
3. Monitor for real `[REAL_ORDER_ATTEMPT]` logs when live trading is enabled.

## Related Files Updated for Kilo Compatibility
- vercel.json (memory + notes)
- Dockerfile (memory + healthcheck)
- package.json (`start` script)
- scripts/vercel-build-setup.sh (coordination verification step)
- This guide + kilo.json

The coordination that successfully created and closed real orders on BingX in both Dev and Production Mode is now deployment-ready for Kilo.ai.
