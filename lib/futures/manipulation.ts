import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { isTestModeEnabled } from "./demo-session"
import { getMarket } from "./markets"
import { effectiveEnd, offsetAt, type FuturesManipulation } from "./manipulation-curve"
import type { Ticker } from "./prices"
import type { Candle } from "./chart-intervals"

// Mantém também as manipulações recém-encerradas para que o histórico de candles continue
// mostrando o movimento depois que ele acabou (senão o gráfico "apagaria" o que aconteceu).
const HISTORY_MS = 2 * 24 * 60 * 60 * 1000
const TTL_MS = 2000

const g = globalThis as unknown as {
  __fxManip?: { at: number; data: FuturesManipulation[] }
  __fxManipInflight?: Promise<FuturesManipulation[]> | null
  __fxTestManip?: FuturesManipulation[]
}

export function testStore() {
  if (!g.__fxTestManip) g.__fxTestManip = []
  return g.__fxTestManip
}

async function fetchRecent(): Promise<FuturesManipulation[]> {
  const since = Date.now() - HISTORY_MS
  if (isTestModeEnabled()) return testStore().filter((m) => effectiveEnd(m) > since)
  const { data, error } = await createAdminClient()
    .from("futures_manipulations")
    .select("*")
    .gt("end_time", new Date(since).toISOString())
    .order("start_time", { ascending: true })
    .limit(300)
  if (error) return g.__fxManip?.data ?? []
  return (data ?? []).map((r) => ({ ...r, move_pct: Number(r.move_pct) })) as FuturesManipulation[]
}

export async function loadManipulations(force = false): Promise<FuturesManipulation[]> {
  const c = g.__fxManip
  if (!force && c && Date.now() - c.at < TTL_MS) return c.data
  if (!g.__fxManipInflight) {
    g.__fxManipInflight = fetchRecent()
      .then((data) => {
        g.__fxManip = { at: Date.now(), data }
        return data
      })
      .finally(() => {
        g.__fxManipInflight = null
      })
  }
  return g.__fxManipInflight
}

export function invalidateManipulations() {
  g.__fxManip = undefined
}

function factorAt(list: FuturesManipulation[], t: number) {
  let off = 0
  for (const m of list) off += offsetAt(m, t)
  return 1 + off
}

function bySymbol(list: FuturesManipulation[]) {
  const map = new Map<string, FuturesManipulation[]>()
  for (const m of list) {
    const arr = map.get(m.symbol) ?? []
    arr.push(m)
    map.set(m.symbol, arr)
  }
  return map
}

const roundTo = (v: number, d: number) => Number(v.toFixed(d))

/** Aplica o deslocamento vigente ao ticker real. Afeta execução, TP/SL e liquidação. */
export async function applyToTickers(raw: Record<string, Ticker>): Promise<Record<string, Ticker>> {
  const list = await loadManipulations().catch(() => [] as FuturesManipulation[])
  if (list.length === 0) return raw
  const now = Date.now()
  const out = { ...raw }
  for (const [symbol, arr] of bySymbol(list)) {
    const t = raw[symbol]
    if (!t) continue
    const f = factorAt(arr, now)
    if (f === 1) continue
    const d = getMarket(symbol)?.priceDecimals ?? 5
    const price = roundTo(t.price * f, d)
    const open = t.price / (1 + t.changePercent / 100)
    out[symbol] = {
      ...t,
      price,
      bid: roundTo((t.bid || t.price) * f, d),
      ask: roundTo((t.ask || t.price) * f, d),
      high: Math.max(t.high, price),
      low: Math.min(t.low, price),
      changePercent: open ? (price / open - 1) * 100 : t.changePercent,
    }
  }
  return out
}

/** Aplica o mesmo deslocamento ao histórico, para o gráfico bater com o preço executado. */
export async function applyToCandles(symbol: string, candles: Candle[], intervalSec: number): Promise<Candle[]> {
  const list = (await loadManipulations().catch(() => [] as FuturesManipulation[])).filter((m) => m.symbol === symbol)
  if (list.length === 0 || candles.length === 0) return candles
  const now = Date.now()
  const from = Math.min(...list.map((m) => new Date(m.start_time).getTime()))
  const d = getMarket(symbol)?.priceDecimals ?? 5
  return candles.map((c) => {
    const t0 = c.time * 1000
    const t1 = Math.min(t0 + intervalSec * 1000, now)
    if (t1 < from) return c
    const samples = [0, 0.25, 0.5, 0.75, 1].map((k) => factorAt(list, t0 + (t1 - t0) * k))
    const fOpen = samples[0]
    const fClose = samples[4]
    if (samples.every((f) => f === 1)) return c
    const open = c.open * fOpen
    const close = c.close * fClose
    return {
      ...c,
      open: roundTo(open, d),
      close: roundTo(close, d),
      high: roundTo(Math.max(c.high * Math.max(...samples), open, close), d),
      low: roundTo(Math.min(c.low * Math.min(...samples), open, close), d),
    }
  })
}
