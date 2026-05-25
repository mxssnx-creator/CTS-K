"use client"

import { useEffect, useRef } from "react"
import { seedProductionData } from "@/lib/production-seeder"

/**
 * EngineAutoInitializer — bootstraps the Global Trade Engine Coordinator
 * (starts workers / progression loops) on dashboard mount.
 * Also seeds essential production data: settings, connections, market data.
 *
 * IMPORTANT STABILITY RULE:
 *   This component MUST NOT mutate connection assignment flags.
 *   Previously it also POSTed to /api/trade-engine/quick-start with
 *   action: "enable", which unconditionally wrote is_active_inserted="1"
 *   and is_enabled_dashboard="1" onto whichever BingX/Bybit connection it
 *   found. That bypassed the user's explicit choice and was the primary
 *   reason a deleted/disabled connection kept reappearing after every page
 *   load. Quick-start enable is now strictly an explicit user action via
 *   the QuickStart button.
 */
export function EngineAutoInitializer() {
  const initRef = useRef(false)
  const seedingRef = useRef(false)

  useEffect(() => {
    // Only initialize once per mount
    if (initRef.current) return
    initRef.current = true

    const initializeProduction = async () => {
      // Prevent multiple seeding attempts
      if (seedingRef.current) return
      seedingRef.current = true

      try {
        console.log("[v0] [EngineAutoInitializer] Starting production initialization...")

        // Ensure the COMPLETE SITE has one unique instance (independent of connections)
        // This makes the whole project/page one continuous unique session.
        // Refresh or open in new tab → same unique site instance, no new overall progressions.
        const { ensureUniqueSiteInstance } = await import("@/lib/redis-db")
        await ensureUniqueSiteInstance().catch(() => {})

        // Seed essential production data first
        await seedProductionData({
          seedSettings: true,
          seedConnections: true,
          seedMarketData: true,
          seedProgression: true
        })
        
        // Start the global coordinator only. This endpoint does NOT touch
        // per-connection assignment flags — it just ensures the background
        // worker loops are running so already-enabled engines progress.
        await fetch("/api/trade-engine/auto-start", {
          method: "POST",
          cache: "no-store",
        }).catch(() => { /* non-critical */ })
        
        console.log("[v0] [EngineAutoInitializer] ✅ Production initialization completed")
      } catch (error) {
        console.error("[v0] [EngineAutoInitializer] ❌ Production initialization failed:", error)
        // Don't throw - allow app to continue even if seeding fails
      } finally {
        seedingRef.current = false
      }
    }

    // Delay slightly to let Next.js finish hydration / layouts mount.
    const timer = setTimeout(initializeProduction, 1000)

    return () => clearTimeout(timer)
  }, [])

  // This component renders nothing, it only performs initialization
  return null
}
