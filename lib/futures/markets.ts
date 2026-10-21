export type MarketCategory = "crypto" | "forex" | "metals"
export type PriceSource = "binance" | "tradingview"

export interface FuturesMarket {
  symbol: string
  name: string
  category: MarketCategory
  base: string
  quote: string
  source: PriceSource
  /** Ticker do widget de grafico do TradingView */
  tvChart: string
  /** Ticker do scanner do TradingView (fonte de preco para forex/metais) */
  tvScan?: { ticker: string; market: "forex" | "cfd" }
  /** Unidades do ativo base por contrato (1 lote forex = 100.000) */
  contractSize: number
  qtyStep: number
  minQty: number
  maxQty: number
  priceDecimals: number
  qtyDecimals: number
  maxLeverage: number
  /** Unidade exibida no campo de quantidade */
  qtyUnit: string
}

export const MAKER_FEE = 0.0002
export const TAKER_FEE = 0.00055
export const MAINTENANCE_MARGIN_RATE = 0.005

const crypto = (
  base: string,
  name: string,
  qtyStep: number,
  priceDecimals: number,
  maxLeverage: number,
): FuturesMarket => {
  const qtyDecimals = Math.max(0, -Math.floor(Math.log10(qtyStep)))
  return {
    symbol: `${base}USDT`,
    name,
    category: "crypto",
    base,
    quote: "USDT",
    source: "binance",
    tvChart: `BYBIT:${base}USDT.P`,
    contractSize: 1,
    qtyStep,
    minQty: qtyStep,
    maxQty: qtyStep * 1_000_000,
    priceDecimals,
    qtyDecimals,
    maxLeverage,
    qtyUnit: base,
  }
}

const forex = (base: string, quote: string, name: string, priceDecimals: number): FuturesMarket => ({
  symbol: `${base}${quote}`,
  name,
  category: "forex",
  base,
  quote,
  source: "tradingview",
  tvChart: `OANDA:${base}${quote}`,
  tvScan: { ticker: `OANDA:${base}${quote}`, market: "forex" },
  contractSize: 100_000,
  qtyStep: 0.01,
  minQty: 0.01,
  maxQty: 100,
  priceDecimals,
  qtyDecimals: 2,
  maxLeverage: 200,
  qtyUnit: "Lotes",
})

export const MARKETS: FuturesMarket[] = [
  crypto("BTC", "Bitcoin", 0.001, 1, 100),
  crypto("ETH", "Ethereum", 0.01, 2, 100),
  crypto("SOL", "Solana", 0.1, 2, 50),
  crypto("XRP", "XRP", 1, 4, 50),
  crypto("BNB", "BNB", 0.01, 2, 50),
  crypto("DOGE", "Dogecoin", 1, 5, 50),
  crypto("ADA", "Cardano", 1, 4, 50),
  crypto("LINK", "Chainlink", 0.1, 3, 50),
  crypto("AVAX", "Avalanche", 0.1, 2, 50),
  crypto("LTC", "Litecoin", 0.01, 2, 50),
  forex("EUR", "USD", "Euro / Dólar", 5),
  forex("GBP", "USD", "Libra / Dólar", 5),
  forex("AUD", "USD", "Dólar Australiano / Dólar", 5),
  forex("NZD", "USD", "Dólar Neozelandês / Dólar", 5),
  forex("USD", "JPY", "Dólar / Iene", 3),
  forex("USD", "CAD", "Dólar / Dólar Canadense", 5),
  forex("USD", "CHF", "Dólar / Franco Suíço", 5),
  {
    symbol: "XAUUSD",
    name: "Ouro",
    category: "metals",
    base: "XAU",
    quote: "USD",
    source: "tradingview",
    tvChart: "OANDA:XAUUSD",
    tvScan: { ticker: "OANDA:XAUUSD", market: "cfd" },
    contractSize: 100,
    qtyStep: 0.01,
    minQty: 0.01,
    maxQty: 50,
    priceDecimals: 2,
    qtyDecimals: 2,
    maxLeverage: 100,
    qtyUnit: "Lotes",
  },
  {
    symbol: "XAGUSD",
    name: "Prata",
    category: "metals",
    base: "XAG",
    quote: "USD",
    source: "tradingview",
    tvChart: "OANDA:XAGUSD",
    tvScan: { ticker: "OANDA:XAGUSD", market: "cfd" },
    contractSize: 5000,
    qtyStep: 0.01,
    minQty: 0.01,
    maxQty: 50,
    priceDecimals: 3,
    qtyDecimals: 2,
    maxLeverage: 100,
    qtyUnit: "Lotes",
  },
]

export const MARKET_MAP: Record<string, FuturesMarket> = Object.fromEntries(MARKETS.map((m) => [m.symbol, m]))

export const DEFAULT_SYMBOL = "BTCUSDT"

export const CATEGORY_LABELS: Record<MarketCategory, string> = {
  crypto: "Cripto USDT",
  forex: "Forex",
  metals: "Metais",
}

export function getMarket(symbol: string | null | undefined): FuturesMarket | undefined {
  if (!symbol) return undefined
  return MARKET_MAP[symbol.toUpperCase()]
}

/** Fator que converte valores na moeda de cotacao para USD ao preco dado. */
export function quoteToUsd(market: FuturesMarket, price: number): number {
  if (market.quote === "USD" || market.quote === "USDT") return 1
  if (market.base === "USD") return 1 / price
  return 1
}

export function notionalUsd(market: FuturesMarket, qty: number, price: number): number {
  return qty * market.contractSize * price * quoteToUsd(market, price)
}

export function unrealizedPnl(
  market: FuturesMarket,
  side: "long" | "short",
  qty: number,
  entry: number,
  mark: number,
): number {
  const dir = side === "long" ? 1 : -1
  return qty * market.contractSize * (mark - entry) * dir * quoteToUsd(market, mark)
}

export function liquidationPrice(side: "long" | "short", entry: number, leverage: number): number {
  return side === "long"
    ? Math.max(entry * (1 - 1 / leverage + MAINTENANCE_MARGIN_RATE), 0)
    : entry * (1 + 1 / leverage - MAINTENANCE_MARGIN_RATE)
}

export function roundToStep(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  return Number((Math.floor(value / step + 1e-9) * step).toFixed(decimals))
}

export function formatPrice(value: number | null | undefined, decimals: number): string {
  if (value == null || !Number.isFinite(value)) return "--"
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function sanitizeDecimalInput(raw: string): string {
  return raw.replace(/[^0-9.,]/g, "")
}

/**
 * Lê números digitados em formato brasileiro (84.206,5), americano (84,206.5) ou sem separador.
 * Quando um único separador é ambíguo ("84,206" ou "84.206"), escolhe a leitura mais próxima de `ref`
 * (o preço atual), para que copiar o preço do gráfico não vire 84,206 em vez de 84206.
 */
export function parseDecimalInput(raw: string, ref?: number | null): number {
  const s = sanitizeDecimalInput(raw.trim())
  if (!s) return NaN
  const commas = (s.match(/,/g) ?? []).length
  const dots = (s.match(/\./g) ?? []).length
  if (commas + dots === 0) return Number(s)

  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."))
  const asDecimal = Number(`${s.slice(0, lastSep).replace(/[.,]/g, "")}.${s.slice(lastSep + 1)}`)
  const asThousands = Number(s.replace(/[.,]/g, ""))

  if (commas > 0 && dots > 0) return asDecimal
  if (commas + dots > 1) return asThousands
  if (s.length - lastSep - 1 !== 3) return asDecimal
  if (ref != null && ref > 0 && asDecimal > 0 && asThousands > 0) {
    return Math.abs(Math.log(asThousands / ref)) < Math.abs(Math.log(asDecimal / ref)) ? asThousands : asDecimal
  }
  return asDecimal
}

/** Mensagem de erro de TP/SL, ou null se estiverem corretos em relação ao preço de referência. */
export function tpSlError(
  side: "buy" | "sell",
  ref: number,
  tp: number | null | undefined,
  sl: number | null | undefined,
  decimals: number,
  refLabel = "preço de entrada",
): string | null {
  const refText = `${refLabel} (${formatPrice(ref, decimals)})`
  const dir = side === "buy" ? "Long" : "Short"
  if (tp != null) {
    if (side === "buy" && tp <= ref) return `Em ${dir}, o Take Profit (${formatPrice(tp, decimals)}) deve ser maior que o ${refText}`
    if (side === "sell" && tp >= ref) return `Em ${dir}, o Take Profit (${formatPrice(tp, decimals)}) deve ser menor que o ${refText}`
  }
  if (sl != null) {
    if (side === "buy" && sl >= ref) return `Em ${dir}, o Stop Loss (${formatPrice(sl, decimals)}) deve ser menor que o ${refText}`
    if (side === "sell" && sl <= ref) return `Em ${dir}, o Stop Loss (${formatPrice(sl, decimals)}) deve ser maior que o ${refText}`
  }
  return null
}

export function formatUsd(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return "--"
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--"
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value)
}
