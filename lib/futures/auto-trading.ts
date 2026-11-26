import type { AccountMode } from "./types"

export interface AutoTradeSettings {
  account: AccountMode
  symbol: string
  marginUsd: number
  leverage: number
  stopLossPercent: number
  takeProfitPercent: number
  dailyTargetPercent: number
  dailyLossPercent: number
  maxTradesPerDay: number
}

export interface AutoTradeSignal {
  scriptId: string
  side: "buy" | "sell"
  time: number
  price: number
}
