export interface Profile {
  id: string
  email: string
  full_name: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface UserBalance {
  id: string
  user_id: string
  balance: number
  currency: string
  account_type: string
  created_at: string
  updated_at: string
}

export interface OTCSymbol {
  id: string
  symbol: string
  name: string
  display_name: string
  base_currency: string
  quote_currency: string
  base_price: number
  volatility: number
  is_active: boolean
  created_at: string
}

export interface Trade {
  id: string
  user_id: string
  symbol: string
  direction: "CALL" | "PUT"
  amount: number
  entry_price: number
  exit_price: number | null
  timeframe: number // column name in DB
  payout_percentage: number // column name in DB
  result: "WIN" | "LOSS" | "PENDING" | null
  profit: number | null
  entry_time: string | null // column name in DB
  expiry_time: string // column name in DB
  exit_time: string | null // column name in DB
  created_at: string
}

export interface TickData {
  type: "tick"
  symbol: string
  price: number
  timestamp: number
}

export interface CandleData {
  type: "candle"
  timeframe: 60 | 300 | 600 | 900
  data: {
    time: number
    open: number
    high: number
    low: number
    close: number
  }
}

export interface TradeResult {
  type: "trade_result"
  tradeId: string
  result: "WIN" | "LOSS"
  exitPrice: number
  profit: number
  newBalance: number
}
