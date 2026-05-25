#!/usr/bin/env node
/**
 * Quickstart Live Trading Test Runner
 * Usage: npm run quickstart
 * 
 * Triggers the full quickstart flow with:
 * - 10 symbols (auto-picked volatile ones)
 * - Minimal volume (live_volume_factor=0.1 forced by API)
 * - Live trade enabled (is_live_trade=1 forced by API)
 * 
 * This makes "npm run quickstart" actually work instead of failing on missing file.
 * It calls the canonical /api/trade-engine/quick-start endpoint.
 */

const PORT = process.env.PORT || 3002;
const BASE = `http://localhost:${PORT}`;

async function main() {
  console.log("[Quickstart] Starting dev-mode live trading quickstart test...");
  console.log(`[Quickstart] Target: ${BASE}`);
  console.log("[Quickstart] Config: 10 symbols, minimal volume (0.1), live trade ENABLED");

  try {
    // First check if server is up (dev mode)
    const health = await fetch(`${BASE}/api/health`, { 
      signal: AbortSignal.timeout(5000) 
    }).catch(() => null);

    if (!health || !health.ok) {
      console.error("[Quickstart] ERROR: Dev server not running on :3002. Start with: npm run dev");
      console.error("[Quickstart] Then run: npm run quickstart");
      process.exit(1);
    }

    // Trigger quickstart with 10 symbols, live trade, minimal vol (API forces the last two)
    const res = await fetch(`${BASE}/api/trade-engine/quick-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enable",
        symbolCount: 10,           // Request 10 symbols (auto volatile pick)
        // connectionId can be passed if needed; API auto-discovers BingX with creds
      }),
      signal: AbortSignal.timeout(120000),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[Quickstart] Quickstart API failed:", res.status, data);
      process.exit(1);
    }

    console.log("[Quickstart] ✅ Quickstart completed successfully");
    console.log("[Quickstart] Response:", JSON.stringify(data, null, 2));

    // Also trigger a quick engine status check
    const statusRes = await fetch(`${BASE}/api/trade-engine/status-all`).catch(() => null);
    if (statusRes) {
      const status = await statusRes.json().catch(() => ({}));
      console.log("[Quickstart] Engine status sample:", JSON.stringify(status, null, 2).slice(0, 800));
    }

    console.log("[Quickstart] Test run complete. Check dashboard /monitoring /strategies for live data.");
    process.exit(0);
  } catch (err) {
    console.error("[Quickstart] FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
