import { type NextRequest, NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/admin/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { isTestModeEnabled } from "@/lib/futures/demo-session"
import { MARKET_MAP } from "@/lib/futures/markets"
import { getRawTickers } from "@/lib/futures/prices"
import { invalidateManipulations, testStore } from "@/lib/futures/manipulation"
import { effectiveEnd, offsetAt, phaseAt, type FuturesManipulation } from "@/lib/futures/manipulation-curve"

export const dynamic = "force-dynamic"

const unauthorized = () => NextResponse.json({ error: "Não autorizado" }, { status: 401 })
const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

const int = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

async function listAll(): Promise<FuturesManipulation[]> {
  if (isTestModeEnabled()) return [...testStore()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100)
  const { data, error } = await createAdminClient()
    .from("futures_manipulations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw new Error("Tabela futures_manipulations ausente ou inacessível")
  return (data ?? []).map((r) => ({ ...r, move_pct: Number(r.move_pct) })) as FuturesManipulation[]
}

export async function GET() {
  if (!(await isAdminRequest())) return unauthorized()
  try {
    const [list, raw] = await Promise.all([listAll(), getRawTickers().catch(() => ({}) as Record<string, { price: number }>)])
    const now = Date.now()
    const manipulations = list.map((m) => {
      const realPrice = raw[m.symbol]?.price ?? null
      const offset = offsetAt(m, now)
      return {
        ...m,
        phase: phaseAt(m, now),
        effective_end: new Date(effectiveEnd(m)).toISOString(),
        offset_pct: offset * 100,
        real_price: realPrice,
        price: realPrice == null ? null : realPrice * (1 + offset),
      }
    })
    return NextResponse.json({ manipulations, serverTime: new Date(now).toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) return unauthorized()
  const body = await req.json().catch(() => ({}))

  const market = MARKET_MAP[String(body.symbol ?? "")]
  if (!market) return bad("Mercado inválido")
  if (body.direction !== "up" && body.direction !== "down") return bad("Direção inválida")
  const movePct = Number(body.movePct)
  if (!Number.isFinite(movePct) || movePct <= 0 || movePct > 20) return bad("Movimento deve ficar entre 0,01% e 20%")
  const ramp = int(body.rampSeconds, 5, 86400)
  const hold = int(body.holdSeconds ?? 0, 0, 86400)
  const release = int(body.releaseSeconds ?? 60, 5, 86400)
  if (ramp == null || hold == null || release == null) return bad("Tempos inválidos")

  let start = new Date()
  if (body.startAt) {
    start = new Date(body.startAt)
    if (Number.isNaN(start.getTime())) return bad("Horário agendado inválido")
    if (start.getTime() < Date.now() - 60_000) return bad("O horário agendado já passou")
  }
  const end = new Date(start.getTime() + (ramp + hold + release) * 1000)
  const row = {
    symbol: market.symbol,
    direction: body.direction,
    move_pct: Number(movePct.toFixed(4)),
    ramp_seconds: ramp,
    hold_seconds: hold,
    release_seconds: release,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    note: typeof body.note === "string" ? body.note.slice(0, 140) || null : null,
  }

  try {
    let created: FuturesManipulation
    if (isTestModeEnabled()) {
      created = { ...row, id: crypto.randomUUID(), stopped_at: null, created_at: new Date().toISOString() } as FuturesManipulation
      testStore().push(created)
    } else {
      const { data, error } = await createAdminClient().from("futures_manipulations").insert(row).select().single()
      if (error) throw new Error(error.message)
      created = data as FuturesManipulation
    }
    invalidateManipulations()
    return NextResponse.json({ manipulation: created })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// PATCH ?id= — interrompe: o preço volta ao real suavemente durante o tempo de devolução.
export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest())) return unauthorized()
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return bad("id obrigatório")
  const now = new Date().toISOString()
  try {
    if (isTestModeEnabled()) {
      const m = testStore().find((x) => x.id === id)
      if (m && !m.stopped_at) m.stopped_at = now
    } else {
      const { error } = await createAdminClient()
        .from("futures_manipulations")
        .update({ stopped_at: now })
        .eq("id", id)
        .is("stopped_at", null)
      if (error) throw new Error(error.message)
    }
    invalidateManipulations()
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// DELETE ?id= — remove o registro. Se ainda estiver em vigor, o preço volta ao real na hora.
export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest())) return unauthorized()
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return bad("id obrigatório")
  try {
    if (isTestModeEnabled()) {
      const store = testStore()
      const i = store.findIndex((x) => x.id === id)
      if (i >= 0) store.splice(i, 1)
    } else {
      const { error } = await createAdminClient().from("futures_manipulations").delete().eq("id", id)
      if (error) throw new Error(error.message)
    }
    invalidateManipulations()
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
