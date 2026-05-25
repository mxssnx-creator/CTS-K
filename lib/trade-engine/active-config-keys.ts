/**
 * active-config-keys.ts
 *
 * Standalone helper that fetches the set of active pseudo-position config
 * keys for a connection from Redis. Extracted from strategy-coordinator.ts
 * so it lives in its own module — guaranteeing the runtime always loads the
 * current compiled version rather than a stale cached chunk from a previous
 * server boot.
 *
 * Every call to `getActiveConfigKeys` is intentionally self-contained:
 * - Accepts an optional warm-cache hint from the caller to avoid a Redis
 *   round-trip when the cache is fresher than 30 seconds.
 * - Falls back to an empty Set on any error so callers never crash.
 */

import { getRedisClient } from "@/lib/redis-db"

export interface ActiveKeysCache {
  keys: Set<string>
  cycleAt: number
}

/**
 * Returns the set of config keys that currently have active (open)
 * pseudo-positions for a given connection.
 *
 * @param connectionId  The connection whose active keys to fetch.
 * @param warmCache     Optional in-process cache entry from the current cycle.
 *                      When present and younger than 30 s the Redis round-trip
 *                      is skipped entirely.
 */
export async function getActiveConfigKeys(
  connectionId: string,
  warmCache?: ActiveKeysCache | null,
): Promise<Set<string>> {
  try {
    if (warmCache && Date.now() - warmCache.cycleAt < 30_000) {
      return warmCache.keys
    }
    const c = getRedisClient()
    const members = await c
      .smembers(`pseudo_positions:${connectionId}:active_config_keys`)
      .catch(() => [] as string[])
    return new Set<string>(members)
  } catch {
    return new Set<string>()
  }
}
