import { type NextRequest, NextResponse } from "next/server"
import { SystemLogger } from "@/lib/system-logger"
import { updateConnection, initRedis, getConnection, setAppSettings, bumpSettingsVersion } from "@/lib/redis-db"
import { RedisTrades, RedisPositions } from "@/lib/redis-operations"
import { recoordinateAfterSettingsChange } from "@/lib/connection-recoordinator"

/**
 * Map of settings payload keys → flat app_settings keys consumed by
 * StrategyCoordinator and EngineManager. These keys bypass the 5s TTL
 * because bumpSettingsVersion() is called after every PATCH that touches them.
 *
 * The coordinator reads these via getAppSettings() with a 5s in-process TTL.
 * bumpSettingsVersion() increments the version counter so
 * getSettingsVersionCachedSync() detects the change and forces a cache refresh
 * on the next cycle without waiting for the TTL to expire naturally.
 */
const PROGRESSION_FLAT_KEYS: Record<string, string> = {
  // PF thresholds
  baseProfitFactor:  "baseProfitFactor",
  mainProfitFactor:  "mainProfitFactor",
  realProfitFactor:  "realProfitFactor",
  liveProfitFactor:  "liveProfitFactor",
  // Stage min-pos eval thresholds
  mainEvalPosCount:  "mainEvalPosCount",
  realEvalPosCount:  "realEvalPosCount",
  stageMinPosCountBase: "stageMinPosCountBase",
  stageMinPosCountMain: "stageMinPosCountMain",
  stageMinPosCountReal: "stageMinPosCountReal",
  // Block variant
  blockVolumeRatio:  "blockVolumeRatio",
  blockMaxStack:     "blockMaxStack",
  // Axis toggles
  axisPrevEnabled:   "axisPrevEnabled",
  axisPrevMaxWindow: "axisPrevMaxWindow",
  axisLastEnabled:   "axisLastEnabled",
  axisLastMaxWindow: "axisLastMaxWindow",
  axisContEnabled:   "axisContEnabled",
  axisContMaxWindow: "axisContMaxWindow",
  axisPauseEnabled:  "axisPauseEnabled",
  axisPauseMaxWindow:"axisPauseMaxWindow",
  // Variant toggles
  variantTrailingEnabled: "variantTrailingEnabled",
  variantBlockEnabled:    "variantBlockEnabled",
  variantDcaEnabled:      "variantDcaEnabled",
  variantPauseEnabled:    "variantPauseEnabled",
  // Hedge / accumulation
  hedgeEnabled:         "hedgeEnabled",
  neutralizeEnabled:    "neutralizeEnabled",
  realAccumulationEnabled: "realAccumulationEnabled",
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await initRedis()
    const connection = await getConnection(id)

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    const trades = await RedisTrades.getTradesByConnection(id)
    const positions = await RedisPositions.getPositionsByConnection(id)

    const settings = typeof connection.connection_settings === "string"
      ? JSON.parse(connection.connection_settings)
      : connection.connection_settings || {}

    return NextResponse.json({
      connection,
      settings,
      statistics: {
        active_trades: trades?.length || 0,
        active_positions: positions?.length || 0,
        created_at: connection.created_at,
        updated_at: connection.updated_at,
      },
    })
  } catch (error) {
    console.error("[v0] [Settings] GET error:", error)
    await SystemLogger.logError(error, "api", "GET /api/settings/connections/[id]/settings")
    return NextResponse.json(
      { error: "Failed to fetch settings", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    await initRedis()
    const connection = await getConnection(id)

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    const updated = {
      ...connection,
      name: body.name || connection.name,
      api_type: body.api_type || connection.api_type,
      connection_method: body.connection_method || connection.connection_method,
      connection_library: body.connection_library || connection.connection_library,
      margin_type: body.margin_type || connection.margin_type,
      position_mode: body.position_mode || connection.position_mode,
      is_testnet: body.is_testnet !== undefined ? body.is_testnet : connection.is_testnet,
      is_enabled: body.is_enabled !== undefined ? body.is_enabled : connection.is_enabled,
      is_active: body.is_active !== undefined ? body.is_active : connection.is_active,
      volume_factor: body.volume_factor || connection.volume_factor,
      connection_settings: body.settings || connection.connection_settings,
      updated_at: new Date().toISOString(),
    }

    await updateConnection(id, updated)

    // ── Write flat app_settings keys for all progression-relevant fields ──
    // Same rationale as the PATCH handler — coordinator reads flat keys from
    // getAppSettings(); bumpSettingsVersion() invalidates the 5s cache.
    if (body.settings && typeof body.settings === "object") {
      const flatUpdate: Record<string, any> = {}
      for (const [payloadKey, appKey] of Object.entries(PROGRESSION_FLAT_KEYS)) {
        const val = body.settings[payloadKey]
        if (val !== undefined) flatUpdate[appKey] = val
      }
      if (Object.keys(flatUpdate).length > 0) {
        try {
          await setAppSettings(flatUpdate)
          await bumpSettingsVersion()
        } catch (settingsErr) {
          console.warn("[v0] [Settings PUT] flat app_settings write failed:", settingsErr)
        }
      }
    }

    // Full propagation: notify + fast-path apply + recoordinate
    // (start/stop/hot-reload as the new state dictates). See
    // lib/connection-recoordinator.ts for the design rationale.
    await recoordinateAfterSettingsChange(id, connection, updated, {
      logTag: "PUT /settings",
    })

    await SystemLogger.logConnection(`Updated settings`, id, "info")

    return NextResponse.json({ success: true, connection: updated })
  } catch (error) {
    console.error("[v0] [Settings] PUT error:", error)
    await SystemLogger.logError(error, "api", "PUT /api/settings/connections/[id]/settings")
    return NextResponse.json(
      { error: "Failed to update settings", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const settings = await request.json()

    await initRedis()
    const connection = await getConnection(id)

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    const current = typeof connection.connection_settings === "string"
      ? JSON.parse(connection.connection_settings)
      : connection.connection_settings || {}

    const merged = { ...current, ...settings }

    const updated = {
      ...connection,
      connection_settings: merged,
      updated_at: new Date().toISOString(),
    }

    await updateConnection(id, updated)

    // ── Write flat app_settings keys for all progression-relevant fields ──
    // StrategyCoordinator reads these directly via getAppSettings() with a 5s
    // in-process TTL. bumpSettingsVersion() invalidates that cache immediately
    // so the next engine cycle picks up the new values without delay.
    const flatAppSettingsUpdate: Record<string, any> = {}
    for (const [payloadKey, appKey] of Object.entries(PROGRESSION_FLAT_KEYS)) {
      // Check both the incoming partial payload AND the merged settings blob
      const val = settings[payloadKey] ?? merged[payloadKey]
      if (val !== undefined) flatAppSettingsUpdate[appKey] = val
    }
    if (Object.keys(flatAppSettingsUpdate).length > 0) {
      try {
        await setAppSettings(flatAppSettingsUpdate)
        await bumpSettingsVersion()
      } catch (settingsErr) {
        console.warn("[v0] [Settings PATCH] flat app_settings write failed:", settingsErr)
      }
    }

    // Full propagation. PATCH only ships a partial settings payload, so
    // `detectChangedFields` (which compares top-level connection fields)
    // would report zero changes — pass an explicit override listing the
    // settings keys the caller touched, so the recoordinator knows
    // something inside `connection_settings` actually changed.
    await recoordinateAfterSettingsChange(
      id,
      { ...connection, connection_settings: current },
      { ...connection, connection_settings: merged, updated_at: updated.updated_at },
      {
        logTag: "PATCH /settings",
        changedFieldsOverride: Object.keys(settings).length > 0 ? ["connection_settings"] : [],
      },
    )

    await SystemLogger.logConnection(`Patched settings`, id, "info")

    return NextResponse.json({ success: true, settings: merged })
  } catch (error) {
    console.error("[v0] [Settings] PATCH error:", error)
    await SystemLogger.logError(error, "api", "PATCH /api/settings/connections/[id]/settings")
    return NextResponse.json(
      { error: "Failed to update settings", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
