import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { isTestModeEnabled } from "./demo-session"
import { getMarket } from "./markets"
import { effectiveEnd, inferAnchor, priceAt, type FuturesManipulation } from "./manipulation-curve"
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
  if (isTestModeEnabled())
    return testStore()
      .filter((m) => effectiveEnd(m) > since)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  const { data, error } = await createAdminClient()
    .from("futures_manipulations")
    .select("*")
    .gt("end_time", new Date(since).toISOString())
    .order("start_time", { ascending: true })
    .limit(300)
  if (error) return g.__fxManip?.data ?? []
  return (data ?? []).map((r) => ({
    ...r,
    move_pct: Number(r.move_pct),
    anchor_price: r.anchor_price == null ? null : Number(r.anchor_price),
  })) as FuturesManipulation[]
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

const isLive = (m: FuturesManipulation, t: number) => t > new Date(m.start_time).getTime() && t < effectiveEnd(m)

/** Encadeia as manipulações do ativo em ordem de início sobre o preço real. */
function chainPrice(list: FuturesManipulation[], t: number, real: number, anchors?: Map<string, number>) {
  let p = real
  for (const m of list) {
    if (!isLive(m, t)) continue
    p = priceAt(m, t, p, m.anchor_price ?? anchors?.get(m.id) ?? null)
  }
  return p
}

function persistAnchor(m: FuturesManipulation, anchor: number) {
  m.anchor_price = anchor
  if (isTestModeEnabled()) return
  void createAdminClient()
    .from("futures_manipulations")
    .update({ anchor_price: anchor })
    .eq("id", m.id)
    .is("anchor_price", null)
    .then(({ error }) => {
      if (!error) invalidateManipulations()
    })
}

/** Garante a âncora das manipulações que acabaram de começar, usando o preço atual. */
function captureAnchors(list: FuturesManipulation[], t: number, real: number) {
  let p = real
  for (const m of list) {
    if (!isLive(m, t)) continue
    if (!m.anchor_price) persistAnchor(m, inferAnchor(m, t, p))
    p = priceAt(m, t, p, m.anchor_price ?? null)
  }
}

/** Para o gráfico: âncora a partir da vela real em que a manipulação começou. */
function anchorsFromCandles(list: FuturesManipulation[], candles: Candle[], intervalSec: number) {
  const map = new Map<string, number>()
  for (const m of list) {
    if (m.anchor_price) continue
    const s = new Date(m.start_time).getTime() / 1000
    const c = candles.find((x) => s >= x.time && s < x.time + intervalSec)
    if (c) map.set(m.id, c.open + (c.close - c.open) * ((s - c.time) / intervalSec))
  }
  return map
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
    captureAnchors(arr, now, t.price)
    const f = chainPrice(arr, now, t.price) / t.price
    if (f === 1 || !Number.isFinite(f)) continue
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
  const anchors = anchorsFromCandles(list, candles, intervalSec)
  return candles.map((c) => {
    const t0 = c.time * 1000
    const t1 = Math.min(t0 + intervalSec * 1000, now)
    if (t1 < from) return c
    const mid = (c.open + c.close) / 2
    const fOpen = chainPrice(list, t0, c.open, anchors) / c.open
    const fClose = chainPrice(list, t1, c.close, anchors) / c.close
    const fMid = chainPrice(list, (t0 + t1) / 2, mid, anchors) / mid
    if (fOpen === 1 && fClose === 1 && fMid === 1) return c
    const open = c.open * fOpen
    const close = c.close * fClose
    // Preserva o tamanho real dos pavios em vez de multiplicá-los pelo pico do intervalo,
    // o que gerava sombras exageradas em todas as velas durante a manipulação.
    const upperWick = Math.max(0, c.high - Math.max(c.open, c.close)) * fMid
    const lowerWick = Math.max(0, Math.min(c.open, c.close) - c.low) * fMid
    const bodyHigh = Math.max(open, close, c.close * fMid)
    const bodyLow = Math.min(open, close, c.close * fMid)
    return {
      ...c,
      open: roundTo(open, d),
      close: roundTo(close, d),
      high: roundTo(bodyHigh + upperWick, d),
      low: roundTo(bodyLow - lowerWick, d),
    }
  })
}
