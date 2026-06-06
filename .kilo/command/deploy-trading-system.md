---
description: Deploy or run the CTS trading engine with working production coordination inside Kilo.ai
agent: code
---

Deploy the Crypto Trading System with the verified production coordination (completeStartup + auto-start self-heal for bingx-x01 + real live orders + control orders).

Steps:
1. Ensure .env.local has real BINGX_API_KEY / BINGX_API_SECRET for bingx-x01.
2. Run `npm run build` (or let Kilo handle it).
3. Start with `npm start` (uses 4096MB as configured).
4. The engine will initialize via instrumentation.ts on cold start.
5. Verify with /api/trade-engine/status — bingx-x01 should self-heal and become active.

For Kilo worktrees: Use the setup in .kilo/deployment.md.

This uses the same coordination that passed real order creation/closing tests on BingX.
