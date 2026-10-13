export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OTCAsset {
  id: string
  symbol: string
  name: string
  category: "forex" | "crypto" | "commodities" | "stocks"
  basePrice: number
  volatility: number
  payout: number
  isActive: boolean
}

export interface PriceUpdate {
  symbol: string
  price: number
  time: number
  change: number
  changePercent: number
}

export interface Trade {
  id: string
  symbol: string
  direction: "call" | "put"
  amount: number
  entryPrice: number
  exitPrice?: number
  entryTime: number
  expiryTime: number
  timeframe: number
  payout: number
  result?: "win" | "loss" | "tie" | "pending"
  profit?: number
  isDemo: boolean
}
