import { MARKETS } from "./markets"
import type { Ticker } from "./prices"

export const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000
const BASE_RATE = 0.0001
const MAX_RATE = 0.0075

export interface DerivativesInfo {
  symbol: string
  markPrice: number
  indexPrice: number
  fundingRate: number
  nextFundingTime: number
  /** Contratos em aberto em USD (null quando a fonte nao informa) */
  openInterestUsd: number | null
}

/** Preco de indice: meio do livro da fonte (nao depende do ultimo negocio). */
export function indexPrice(t: Ticker): number {
  const bid = t.bid > 0 ? t.bid : t.price
  const ask = t.ask > 0 ? t.ask : t.price
  return (bid + ask) / 2
}

/**
 * Preco de marcacao: mediana entre melhor compra, melhor venda e ultimo negocio,
 * limitada a 0,5% do indice. Um pico isolado no ultimo negocio nao move a marcacao,
 * entao nao causa liquidacao.
 */
export function markPrice(t: Ticker): number {
  const idx = indexPrice(t)
  const bid = t.bid > 0 ? t.bid : t.price
  const ask = t.ask > 0 ? t.ask : t.price
  const median = [bid, ask, t.price].sort((a, b) => a - b)[1]
  return Math.min(Math.max(median, idx * 0.995), idx * 1.005)
}

export function lastFundingTime(now = Date.now()) {
  return Math.floor(now / FUNDING_INTERVAL_MS) * FUNDING_INTERVAL_MS
}

export function nextFundingTime(now = Date.now()) {
  return lastFundingTime(now) + FUNDING_INTERVAL_MS
}

function syntheticRate(t: Ticker) {
  const idx = indexPrice(t)
  const premium = idx > 0 ? (markPrice(t) - idx) / idx : 0
  const clamp = (v: number, lim: number) => Math.min(Math.max(v, -lim), lim)
  return clamp(premium + clamp(BASE_RATE - premium, 0.0005), MAX_RATE)
}

const OKX_TTL = 60_000
type OkxData = { at: number; funding: Record<string, number>; oi: Record<string, number> }
let okxCache: OkxData | null = null
let okxInflight: Promise<OkxData> | null = null

async function loadOkx(): Promise<OkxData> {
  const funding: Record<string, number> = {}
  const oi: Record<string, number> = {}
  const crypto = MARKETS.filter((m) => m.category === "crypto")
  const [fr, oiRes] = await Promise.allSettled([
    fetch("https://www.okx.com/api/v5/public/funding-rate?instId=ANY", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }).then((r) => r.json()),
    fetch("https://www.okx.com/api/v5/public/open-interest?instType=SWAP", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }).then((r) => r.json()),
  ])
  const wanted = new Map(crypto.map((m) => [`${m.base}-USDT-SWAP`, m.symbol]))
  if (fr.status === "fulfilled") {
    for (const row of fr.value?.data ?? []) {
      const symbol = wanted.get(row.instId)
      const rate = Number(row.fundingRate)
      if (symbol && Number.isFinite(rate)) funding[symbol] = Math.min(Math.max(rate, -MAX_RATE), MAX_RATE)
    }
  }
  if (oiRes.status === "fulfilled") {
    for (const row of oiRes.value?.data ?? []) {
      const symbol = wanted.get(row.instId)
      const usd = Number(row.oiUsd)
      if (symbol && Number.isFinite(usd)) oi[symbol] = usd
    }
  }
  return { at: Date.now(), funding, oi }
}

async function getOkx(): Promise<OkxData> {
  if (okxCache && Date.now() - okxCache.at < OKX_TTL) return okxCache
  if (!okxInflight) {
    okxInflight = loadOkx()
      .then((d) => {
        okxCache = d
        return d
      })
      .catch((): OkxData => okxCache ?? { at: 0, funding: {}, oi: {} })
      .finally(() => {
        okxInflight = null
      })
  }
  return okxInflight
}

export async function getDerivatives(tickers: Record<string, Ticker>): Promise<Record<string, DerivativesInfo>> {
  const okx = await getOkx()
  const next = nextFundingTime()
  const out: Record<string, DerivativesInfo> = {}
  for (const [symbol, t] of Object.entries(tickers)) {
    out[symbol] = {
      symbol,
      markPrice: markPrice(t),
      indexPrice: indexPrice(t),
      fundingRate: okx.funding[symbol] ?? syntheticRate(t),
      nextFundingTime: next,
      openInterestUsd: okx.oi[symbol] ?? null,
    }
  }
  return out
}
