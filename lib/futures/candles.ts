import type { FuturesMarket } from "./markets"
import { getRawTickers } from "./prices"
import { INTERVAL_SECONDS, type Candle, type ChartInterval } from "./chart-intervals"

export { INTERVALS, INTERVAL_SECONDS, type Candle, type ChartInterval } from "./chart-intervals"

const cache = new Map<string, { at: number; data: Candle[] }>()
const TTL_MS = 15_000

async function fromBinance(market: FuturesMarket, interval: ChartInterval): Promise<Candle[]> {
  const res = await fetch(
    `https://data-api.binance.vision/api/v3/klines?symbol=${market.symbol}&interval=${interval}&limit=500`,
    { cache: "no-store", signal: AbortSignal.timeout(5000) },
  )
  if (!res.ok) throw new Error(`binance ${res.status}`)
  const rows = (await res.json()) as Array<[number, string, string, string, string, string]>
  return rows.map((r) => ({
    time: Math.floor(r[0] / 1000),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }))
}

const YAHOO: Record<ChartInterval, { interval: string; range: string; group: number }> = {
  "1m": { interval: "1m", range: "5d", group: 1 },
  "5m": { interval: "5m", range: "1mo", group: 1 },
  "15m": { interval: "15m", range: "1mo", group: 1 },
  "1h": { interval: "60m", range: "3mo", group: 1 },
  "4h": { interval: "60m", range: "6mo", group: 4 },
  "1d": { interval: "1d", range: "2y", group: 1 },
}

function yahooSymbol(market: FuturesMarket) {
  if (market.symbol === "XAUUSD") return "GC=F"
  if (market.symbol === "XAGUSD") return "SI=F"
  return `${market.base}${market.quote}=X`
}

function groupCandles(candles: Candle[], seconds: number): Candle[] {
  const out: Candle[] = []
  for (const c of candles) {
    const bucket = Math.floor(c.time / seconds) * seconds
    const last = out.at(-1)
    if (last && last.time === bucket) {
      last.high = Math.max(last.high, c.high)
      last.low = Math.min(last.low, c.low)
      last.close = c.close
      last.volume += c.volume
    } else {
      out.push({ ...c, time: bucket })
    }
  }
  return out
}

async function fromYahoo(market: FuturesMarket, interval: ChartInterval): Promise<Candle[]> {
  const cfg = YAHOO[interval]
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(market))}?interval=${cfg.interval}&range=${cfg.range}`,
    { cache: "no-store", signal: AbortSignal.timeout(5000), headers: { "User-Agent": "Mozilla/5.0" } },
  )
  if (!res.ok) throw new Error(`yahoo ${res.status}`)
  const json = await res.json()
  const r = json?.chart?.result?.[0]
  const ts: number[] = r?.timestamp ?? []
  const q = r?.indicators?.quote?.[0] ?? {}
  let candles: Candle[] = []
  for (let i = 0; i < ts.length; i++) {
    const [o, h, l, c] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i]]
    if (![o, h, l, c].every((v) => Number.isFinite(v) && v > 0)) continue
    candles.push({ time: ts[i], open: o, high: h, low: l, close: c, volume: 0 })
  }
  if (cfg.group > 1) candles = groupCandles(candles, INTERVAL_SECONDS[interval])
  return candles.slice(-500)
}

/**
 * Historico de candles alinhado ao preco do nosso motor: o ultimo candle sempre termina no
 * preco que o motor usa para executar ordens. Para metais o historico vem de contratos futuros,
 * entao a serie e ajustada pela base (diferenca futuro x spot) para ficar no mesmo nivel.
 */
export async function getCandles(market: FuturesMarket, interval: ChartInterval): Promise<Candle[]> {
  const key = `${market.symbol}:${interval}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data

  const [raw, tickers] = await Promise.all([
    market.source === "binance" ? fromBinance(market, interval) : fromYahoo(market, interval),
    getRawTickers().catch(() => ({}) as Record<string, { price: number }>),
  ])

  let data = raw
  const enginePrice = tickers[market.symbol]?.price
  const lastClose = raw.at(-1)?.close
  if (market.source !== "binance" && enginePrice && lastClose) {
    const ratio = enginePrice / lastClose
    const round = (v: number) => Number((v * ratio).toFixed(market.priceDecimals))
    data = raw.map((c) => ({ ...c, open: round(c.open), high: round(c.high), low: round(c.low), close: round(c.close) }))
  }

  cache.set(key, { at: Date.now(), data })
  return data
}
