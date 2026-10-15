import { MARKETS, type FuturesMarket } from "./markets"

export interface Ticker {
  symbol: string
  price: number
  bid: number
  ask: number
  changePercent: number
  high: number
  low: number
  /** Volume em 24h na moeda de cotacao (0 quando a fonte nao informa) */
  volume: number
  updatedAt: number
}

// Cache curto compartilhado entre requisicoes da mesma instancia: a fonte e consultada
// no maximo uma vez por segundo, independente da quantidade de usuarios.
const TTL_MS = 1000
let cache: { at: number; data: Record<string, Ticker> } | null = null
let inflight: Promise<Record<string, Ticker>> | null = null

async function fetchBinance(markets: FuturesMarket[]): Promise<Ticker[]> {
  if (markets.length === 0) return []
  const symbols = encodeURIComponent(JSON.stringify(markets.map((m) => m.symbol)))
  const res = await fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${symbols}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) throw new Error(`binance ${res.status}`)
  const rows = (await res.json()) as Array<Record<string, string>>
  return rows.map((r) => ({
    symbol: r.symbol,
    price: Number(r.lastPrice),
    bid: Number(r.bidPrice),
    ask: Number(r.askPrice),
    changePercent: Number(r.priceChangePercent),
    high: Number(r.highPrice),
    low: Number(r.lowPrice),
    volume: Number(r.quoteVolume),
    updatedAt: Date.now(),
  }))
}

async function fetchOkx(market: FuturesMarket): Promise<Ticker | null> {
  const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${market.base}-USDT-SWAP`, {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) return null
  const json = await res.json()
  const d = json?.data?.[0]
  if (!d) return null
  const price = Number(d.last)
  const open = Number(d.open24h)
  return {
    symbol: market.symbol,
    price,
    bid: Number(d.bidPx),
    ask: Number(d.askPx),
    changePercent: open ? ((price - open) / open) * 100 : 0,
    high: Number(d.high24h),
    low: Number(d.low24h),
    volume: Number(d.volCcy24h) * price,
    updatedAt: Date.now(),
  }
}

async function fetchTradingView(markets: FuturesMarket[], scanMarket: "forex" | "cfd"): Promise<Ticker[]> {
  const list = markets.filter((m) => m.tvScan?.market === scanMarket)
  if (list.length === 0) return []
  const res = await fetch(`https://scanner.tradingview.com/${scanMarket}/scan`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      symbols: { tickers: list.map((m) => m.tvScan!.ticker), query: { types: [] } },
      columns: ["close", "change", "high", "low", "bid", "ask"],
    }),
  })
  if (!res.ok) throw new Error(`tradingview ${res.status}`)
  const json = await res.json()
  const byTicker = new Map(list.map((m) => [m.tvScan!.ticker, m]))
  const out: Ticker[] = []
  for (const row of json?.data ?? []) {
    const market = byTicker.get(row.s)
    if (!market) continue
    const [close, change, high, low, bid, ask] = row.d as number[]
    if (!Number.isFinite(close) || close <= 0) continue
    out.push({
      symbol: market.symbol,
      price: close,
      bid: Number.isFinite(bid) && bid > 0 ? bid : close,
      ask: Number.isFinite(ask) && ask > 0 ? ask : close,
      changePercent: Number.isFinite(change) ? change : 0,
      high: high ?? close,
      low: low ?? close,
      volume: 0,
      updatedAt: Date.now(),
    })
  }
  return out
}

async function loadAll(): Promise<Record<string, Ticker>> {
  const binanceMarkets = MARKETS.filter((m) => m.source === "binance")
  const [binance, fx, cfd] = await Promise.allSettled([
    fetchBinance(binanceMarkets),
    fetchTradingView(MARKETS, "forex"),
    fetchTradingView(MARKETS, "cfd"),
  ])

  const data: Record<string, Ticker> = { ...(cache?.data ?? {}) }
  const put = (r: PromiseSettledResult<Ticker[]>) => {
    if (r.status === "fulfilled") for (const t of r.value) data[t.symbol] = t
  }
  put(binance)
  put(fx)
  put(cfd)

  if (binance.status === "rejected") {
    const fallback = await Promise.allSettled(binanceMarkets.map(fetchOkx))
    for (const r of fallback) if (r.status === "fulfilled" && r.value) data[r.value.symbol] = r.value
  }
  return data
}

/** Preços como a corretora os pratica: feed real + manipulações do admin em vigor. */
export async function getAllTickers(): Promise<Record<string, Ticker>> {
  const raw = await getRawTickers()
  const { applyToTickers } = await import("./manipulation")
  return applyToTickers(raw)
}

/** Preços do feed real, sem manipulação. */
export async function getRawTickers(): Promise<Record<string, Ticker>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data
  if (!inflight) {
    inflight = loadAll()
      .then((data) => {
        cache = { at: Date.now(), data }
        return data
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Preco atual valido para execucao. Recusa preco com mais de 30s (fonte fora do ar). */
export async function getExecutionTicker(symbol: string): Promise<Ticker | null> {
  const all = await getAllTickers()
  const t = all[symbol]
  if (!t || !Number.isFinite(t.price) || t.price <= 0) return null
  if (Date.now() - t.updatedAt > 30_000) return null
  return t
}
