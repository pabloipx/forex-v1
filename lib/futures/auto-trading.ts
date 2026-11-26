import type { AccountMode } from "./types"
import type { ChartInterval } from "./chart-intervals"

export interface AutoTradeSettings {
  account: AccountMode
  symbol: string
  timeframe: ChartInterval
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
  timeframe: ChartInterval
  time: number
  price: number
}

export interface AutoTradeStatus {
  settings: AutoTradeSettings
  tradesToday: number
  dailyPnlPercent: number
  lastEvent?: string
}
