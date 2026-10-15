import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseUserAgent } from "@/lib/device-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const body = z.object({
  deviceId: z.string().min(4).max(100),
  event: z.enum(["login", "seen"]).default("seen"),
  model: z.string().max(80).nullish(),
})

const SEEN_THROTTLE_MS = 5 * 60 * 1000

function header(req: NextRequest, name: string) {
  const v = req.headers.get(name)
  if (!v) return null
  try {
    return decodeURIComponent(v).slice(0, 120)
  } catch {
    return v.slice(0, 120)
  }
}

export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { deviceId, event, model } = parsed.data
  const ua = (request.headers.get("user-agent") ?? "").slice(0, 400)
  const parsedUa = parseUserAgent(ua)
  const geo = {
    ip: (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null)?.slice(0, 64) ?? null,
    city: header(request, "x-vercel-ip-city"),
    region: header(request, "x-vercel-ip-country-region"),
    country: header(request, "x-vercel-ip-country"),
  }
  const device = {
    device_name: parsedUa.deviceName,
    model: model?.trim() || parsedUa.model,
    browser: parsedUa.browser,
    os: parsedUa.os,
    user_agent: ua,
  }

  const db = createAdminClient()
  const now = new Date().toISOString()
  const { data: existing } = await db
    .from("login_sessions")
    .select("id, last_seen, login_count")
    .eq("user_id", user.id)
    .eq("device_id", deviceId)
    .maybeSingle()

  if (existing && event === "seen" && Date.now() - new Date(existing.last_seen).getTime() < SEEN_THROTTLE_MS) {
    return NextResponse.json({ ok: true, throttled: true })
  }

  const row = { user_id: user.id, device_id: deviceId, ...device, ...geo, last_seen: now }
  const writes: PromiseLike<unknown>[] = [
    existing
      ? db
          .from("login_sessions")
          .update({ ...row, login_count: (existing.login_count ?? 1) + (event === "login" ? 1 : 0) })
          .eq("id", existing.id)
      : db.from("login_sessions").insert({ ...row, login_count: 1 }),
  ]
  if (event === "login" || !existing) {
    writes.push(db.from("login_events").insert({ user_id: user.id, device_id: deviceId, ...device, ...geo }))
    writes.push(db.from("profiles").update({ last_login_at: now }).eq("id", user.id))
  }
  await Promise.all(writes)
  return NextResponse.json({ ok: true })
}
