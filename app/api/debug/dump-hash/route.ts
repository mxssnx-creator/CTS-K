import { NextResponse } from "next/server"
import { getRedisClient } from "@/lib/redis-db"

// TEMP DIAGNOSTIC — dump any hash by key for engine-stats verification.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get("key")
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 })
  const redis = getRedisClient()
  const hash = (await redis.hgetall(key).catch(() => ({}))) || {}
  return NextResponse.json({ key, fields: Object.keys(hash).length, hash })
}
