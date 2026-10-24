import type { SupabaseClient } from "@supabase/supabase-js"

export interface UsdBrlRate {
  /** Cotacao de mercado (venda / ask) do dolar comercial. */
  rate: number
  source: "awesomeapi" | "yahoo" | "coinbase" | "open-er-api"
  updatedAt: string
}

export interface DepositSettings {
  minDepositUsd: number
  maxDepositUsd: number
  /** Spread aplicado sobre a cotacao de mercado no deposito PIX, em %. */
  fxSpreadPercent: number
}

export const DEFAULT_MIN_DEPOSIT_USD = 100
export const DEFAULT_MAX_DEPOSIT_USD = 20000
export const DEFAULT_FX_SPREAD_PERCENT = 0

// A cotacao muda a cada poucos segundos, mas nao vale a pena bater na API a cada requisicao:
// 30s mantem o valor praticamente em tempo real e evita rate limit do provedor.
const CACHE_MS = 30_000
let cached: { value: UsdBrlRate; at: number } | null = null

async function fromAwesomeApi(): Promise<UsdBrlRate | null> {
  const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) return null
  const data = await res.json()
  const quote = data?.USDBRL
  const rate = Number(quote?.ask ?? quote?.bid)
  if (!Number.isFinite(rate) || rate <= 0) return null
  const ts = Number(quote?.timestamp)
  return {
    rate,
    source: "awesomeapi",
    updatedAt: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
  }
}

async function fromYahoo(): Promise<UsdBrlRate | null> {
  const res = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/BRL=X?interval=1m&range=1d", {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) return null
  const data = await res.json()
  const meta = data?.chart?.result?.[0]?.meta
  const rate = Number(meta?.regularMarketPrice)
  if (!Number.isFinite(rate) || rate <= 0) return null
  const ts = Number(meta?.regularMarketTime)
  return {
    rate,
    source: "yahoo",
    updatedAt: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
  }
}

async function fromCoinbase(): Promise<UsdBrlRate | null> {
  const res = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=USD", {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) return null
  const data = await res.json()
  const rate = Number(data?.data?.rates?.BRL)
  if (!Number.isFinite(rate) || rate <= 0) return null
  return { rate, source: "coinbase", updatedAt: new Date().toISOString() }
}

async function fromOpenErApi(): Promise<UsdBrlRate | null> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) return null
  const data = await res.json()
  const rate = Number(data?.rates?.BRL)
  if (!Number.isFinite(rate) || rate <= 0) return null
  return {
    rate,
    source: "open-er-api",
    updatedAt: data?.time_last_update_unix
      ? new Date(Number(data.time_last_update_unix) * 1000).toISOString()
      : new Date().toISOString(),
  }
}

/**
 * Cotacao USD/BRL em tempo real. Tenta a AwesomeAPI, depois Yahoo Finance e Coinbase (todas ao
 * vivo) e, por ultimo, a open.er-api (diaria). Nunca usa uma cotacao fixa: sem cotacao valida, lanca erro e o
 * deposito nao e gerado, para nunca cobrar o cliente com um cambio desatualizado.
 */
export async function getUsdBrlRate(): Promise<UsdBrlRate> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value

  for (const provider of [fromAwesomeApi, fromYahoo, fromCoinbase, fromOpenErApi]) {
    try {
      const value = await provider()
      if (value) {
        cached = { value, at: Date.now() }
        return value
      }
    } catch (err) {
      console.error("[FX] Falha ao consultar cotacao:", err)
    }
  }

  // Uma cotacao de ate 10 minutos ainda e aceitavel se todos os provedores cairem de uma vez.
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.value
  throw new Error("Cotacao do dolar indisponivel no momento. Tente novamente em instantes.")
}

function parseSettingNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const n = Number(String(raw).replace(/"/g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

export async function getDepositSettings(admin: SupabaseClient): Promise<DepositSettings> {
  const { data } = await admin
    .from("platform_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["deposit_min_usd", "deposit_max_usd", "pix_fx_spread_percent"])

  const map = new Map((data || []).map((s: { setting_key: string; setting_value: unknown }) => [s.setting_key, s.setting_value]))

  const min = parseSettingNumber(map.get("deposit_min_usd"))
  const max = parseSettingNumber(map.get("deposit_max_usd"))
  const spread = parseSettingNumber(map.get("pix_fx_spread_percent"))

  return {
    minDepositUsd: min && min > 0 ? min : DEFAULT_MIN_DEPOSIT_USD,
    maxDepositUsd: max && max > 0 ? max : DEFAULT_MAX_DEPOSIT_USD,
    fxSpreadPercent: spread !== null && spread >= 0 ? spread : DEFAULT_FX_SPREAD_PERCENT,
  }
}

export function effectiveRate(marketRate: number, spreadPercent: number): number {
  return Math.round(marketRate * (1 + spreadPercent / 100) * 10000) / 10000
}

/** Valor em reais a pagar por um deposito em dolar. Arredonda para cima no centavo. */
export function usdToBrl(usd: number, rate: number): number {
  return Math.ceil(usd * rate * 100 - 1e-9) / 100
}
