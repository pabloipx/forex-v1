import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { isTestModeEnabled } from "./demo-session"
import { MAKER_FEE, MARKETS, TAKER_FEE, getMarket } from "./markets"
import type { Ticker } from "./prices"

export interface MarketParams {
  symbol: string
  enabled: boolean
  maxLeverage: number
  takerFee: number
  makerFee: number
  /** Markup adicional sobre o spread da fonte, em pontos-base (1 bp = 0,01%) */
  spreadBps: number
}

export function defaultParams(symbol: string): MarketParams {
  const m = getMarket(symbol)
  return {
    symbol,
    enabled: true,
    maxLeverage: m?.maxLeverage ?? 100,
    takerFee: TAKER_FEE,
    makerFee: MAKER_FEE,
    spreadBps: 0,
  }
}

const TTL_MS = 5000
const g = globalThis as unknown as {
  __fxMarketSettings?: { at: number; data: Record<string, MarketParams> }
  __fxTestMarketSettings?: Record<string, Partial<MarketParams>>
}

function merge(overrides: Record<string, Partial<MarketParams>>) {
  const data: Record<string, MarketParams> = {}
  for (const m of MARKETS) data[m.symbol] = { ...defaultParams(m.symbol), ...(overrides[m.symbol] ?? {}) }
  return data
}

async function fetchOverrides(): Promise<Record<string, Partial<MarketParams>>> {
  if (isTestModeEnabled()) return g.__fxTestMarketSettings ?? {}
  const { data, error } = await createAdminClient().from("futures_market_settings").select("*")
  if (error) return {}
  const out: Record<string, Partial<MarketParams>> = {}
  for (const r of data ?? []) {
    out[r.symbol as string] = {
      enabled: r.enabled !== false,
      maxLeverage: Number(r.max_leverage),
      takerFee: Number(r.taker_fee),
      makerFee: Number(r.maker_fee),
      spreadBps: Number(r.spread_bps),
    }
  }
  return out
}

/** Carrega (com cache curto) as configurações de todos os mercados. */
export async function ensureMarketSettings(force = false) {
  const c = g.__fxMarketSettings
  if (!force && c && Date.now() - c.at < TTL_MS) return c.data
  const data = merge(await fetchOverrides())
  g.__fxMarketSettings = { at: Date.now(), data }
  return data
}

/** Leitura síncrona; chamar ensureMarketSettings() antes no mesmo fluxo. */
export function paramsFor(symbol: string): MarketParams {
  return g.__fxMarketSettings?.data[symbol] ?? defaultParams(symbol)
}

export function withSpread(t: Ticker, spreadBps: number): Ticker {
  if (!spreadBps) return t
  const half = (t.price * spreadBps) / 20000
  return { ...t, bid: (t.bid || t.price) - half, ask: (t.ask || t.price) + half }
}

export async function saveMarketParams(symbol: string, patch: Partial<MarketParams>) {
  const market = getMarket(symbol)
  if (!market) throw new Error("Mercado inválido")
  const current = (await ensureMarketSettings(true))[symbol]
  const next: MarketParams = { ...current, ...patch, symbol }
  next.maxLeverage = Math.max(1, Math.min(1000, Math.floor(next.maxLeverage)))
  next.takerFee = Math.max(0, Math.min(0.01, next.takerFee))
  next.makerFee = Math.max(-0.001, Math.min(0.01, next.makerFee))
  next.spreadBps = Math.max(0, Math.min(500, next.spreadBps))

  if (isTestModeEnabled()) {
    g.__fxTestMarketSettings = { ...(g.__fxTestMarketSettings ?? {}), [symbol]: next }
  } else {
    const { error } = await createAdminClient()
      .from("futures_market_settings")
      .upsert(
        {
          symbol,
          enabled: next.enabled,
          max_leverage: next.maxLeverage,
          taker_fee: next.takerFee,
          maker_fee: next.makerFee,
          spread_bps: next.spreadBps,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "symbol" },
      )
    if (error) throw new Error("Tabela futures_market_settings ausente. Rode scripts/300_forex_admin.sql.")
  }
  await ensureMarketSettings(true)
  return next
}
