import { OTC_ASSETS } from "@/lib/price-engine/multi-asset-engine"

export interface AssetUIInfo {
  symbol: string
  name: string
  category: "forex" | "crypto" | "stocks"
  payout: number
  logo: string
  /** "otc" = disponivel sempre; "open" = mercado aberto (pares reais) */
  market: "otc" | "open"
}

/**
 * Metadados de UI (nome de exibição, categoria, payout e logo) por símbolo.
 * A fonte de verdade dos preços continua sendo OTC_ASSETS no price engine.
 */
const ASSET_UI: Record<string, Omit<AssetUIInfo, "symbol">> = {
  EURUSD_OTC: { name: "EUR/USD (OTC)", category: "forex", payout: 96, logo: "/images/a1640800-8419-484d-9351.jpeg", market: "otc" },
  GBPUSD_OTC: { name: "GBP/USD (OTC)", category: "forex", payout: 96, logo: "/images/5c13c1c5-2d6b-4006-b117.jpeg", market: "otc" },
  USDJPY_OTC: { name: "USD/JPY (OTC)", category: "forex", payout: 96, logo: "/images/06fd67b4-821f-4dad-9daf.jpeg", market: "otc" },
  AUDUSD_OTC: { name: "AUD/USD (OTC)", category: "forex", payout: 96, logo: "/images/82329959-774d-46ff-b731.jpeg", market: "otc" },
  BTCUSD_OTC: { name: "BTC/USD (OTC)", category: "crypto", payout: 96, logo: "/images/a8ba8d63-a559-42c6-955c.jpeg", market: "otc" },
  USDBRL_OTC: { name: "USD/BRL (OTC)", category: "forex", payout: 92, logo: "/images/assets/usdbrl-otc.png", market: "otc" },
  SPACEX_OTC: { name: "SpaceXCoin (OTC)", category: "crypto", payout: 90, logo: "/images/assets/spacex-otc.png", market: "otc" },
  TRUMP_OTC: { name: "TRUMP Coin (OTC)", category: "crypto", payout: 90, logo: "/images/assets/trump-otc.png", market: "otc" },
  AMZN_OTC: { name: "Amazon (OTC)", category: "stocks", payout: 92, logo: "/images/assets/amzn-otc.png", market: "otc" },
  PENUSD_OTC: { name: "PEN/USD (OTC)", category: "forex", payout: 92, logo: "/images/assets/penusd-otc.png", market: "otc" },
  ONDO_OTC: { name: "Ondo (OTC)", category: "crypto", payout: 90, logo: "/images/assets/ondo-otc.png", market: "otc" },
  SHIBUSD_OTC: { name: "SHIB/USD (OTC)", category: "crypto", payout: 90, logo: "/images/assets/shib-otc.png", market: "otc" },
  TSLA_OTC: { name: "Tesla (OTC)", category: "stocks", payout: 92, logo: "/images/assets/tsla-otc.png", market: "otc" },
  PEPE_OTC: { name: "Pepe (OTC)", category: "crypto", payout: 90, logo: "/images/assets/pepe-otc.png", market: "otc" },
  META_OTC: { name: "Meta (OTC)", category: "stocks", payout: 92, logo: "/images/assets/meta-otc.png", market: "otc" },
  DOGE_OTC: { name: "DogeCoin (OTC)", category: "crypto", payout: 90, logo: "/images/assets/doge-otc.png", market: "otc" },
  GBPJPY_OTC: { name: "GBP/JPY (OTC)", category: "forex", payout: 96, logo: "/images/assets/gbpjpy-otc.png", market: "otc" },
  EURJPY_OTC: { name: "EUR/JPY (OTC)", category: "forex", payout: 96, logo: "/images/assets/eurjpy-otc.png", market: "otc" },
  AUDJPY_OTC: { name: "AUD/JPY (OTC)", category: "forex", payout: 96, logo: "/images/assets/audjpy-otc.png", market: "otc" },
  // Mercado aberto (pares reais de forex)
  EURUSD: { name: "EUR/USD", category: "forex", payout: 85, logo: "/images/assets/eurusd-open.png", market: "open" },
  GBPJPY: { name: "GBP/JPY", category: "forex", payout: 85, logo: "/images/assets/gbpjpy-open.png", market: "open" },
  EURJPY: { name: "EUR/JPY", category: "forex", payout: 85, logo: "/images/assets/eurjpy-open.png", market: "open" },
  AUDUSD: { name: "AUD/USD", category: "forex", payout: 85, logo: "/images/assets/audusd-open.png", market: "open" },
  AUDJPY: { name: "AUD/JPY", category: "forex", payout: 85, logo: "/images/assets/audjpy-open.png", market: "open" },
  BTCUSD: { name: "BTC/USD", category: "crypto", payout: 85, logo: "/images/assets/btcusd-open.png", market: "open" },
  // Majors reais adicionais (cotacao ao vivo do forex de verdade)
  GBPUSD: { name: "GBP/USD", category: "forex", payout: 85, logo: "/images/assets/gbpusd-open.png", market: "open" },
  USDJPY: { name: "USD/JPY", category: "forex", payout: 85, logo: "/images/assets/usdjpy-open.png", market: "open" },
  USDCHF: { name: "USD/CHF", category: "forex", payout: 85, logo: "/images/assets/usdchf-open.png", market: "open" },
  USDCAD: { name: "USD/CAD", category: "forex", payout: 85, logo: "/images/assets/usdcad-open.png", market: "open" },
  NZDUSD: { name: "NZD/USD", category: "forex", payout: 85, logo: "/images/assets/nzdusd-open.png", market: "open" },
  EURGBP: { name: "EUR/GBP", category: "forex", payout: 85, logo: "/images/assets/eurgbp-open.png", market: "open" },
}

const FALLBACK_LOGO = "/placeholder.svg"

/** Catálogo completo (todos os ativos existentes no price engine + metadados de UI). */
export const ASSET_CATALOG: AssetUIInfo[] = OTC_ASSETS.map((a) => {
  const ui = ASSET_UI[a.symbol]
  return {
    symbol: a.symbol,
    name: ui?.name || a.name,
    category: ui?.category || "forex",
    payout: ui?.payout ?? 90,
    logo: ui?.logo || FALLBACK_LOGO,
    market: ui?.market || "otc",
  }
})

export function getAssetUI(symbol: string): AssetUIInfo | undefined {
  return ASSET_CATALOG.find((a) => a.symbol === symbol)
}
