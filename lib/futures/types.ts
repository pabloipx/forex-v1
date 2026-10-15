export type AccountMode = "demo" | "real"
export type OrderSide = "buy" | "sell"
export type PositionSide = "long" | "short"
export type OrderType = "market" | "limit" | "conditional"
export type MarginMode = "isolated" | "cross"
export type TimeInForce = "GTC" | "IOC" | "FOK" | "PostOnly"

export interface Position {
  id: string
  symbol: string
  side: PositionSide
  qty: number
  entry_price: number
  leverage: number
  margin_mode: MarginMode
  margin: number
  contract_size: number
  liquidation_price: number | null
  take_profit: number | null
  stop_loss: number | null
  trailing_distance?: number | null
  trailing_peak?: number | null
  funding_paid?: number
  realized_pnl: number
  fees_paid: number
  exit_price: number | null
  close_reason: string | null
  status: "open" | "closed" | "liquidated"
  is_demo: boolean
  opened_at: string
  closed_at: string | null
}

export interface Order {
  id: string
  symbol: string
  side: OrderSide
  order_type: OrderType
  price: number | null
  trigger_price: number | null
  trigger_direction: "rise" | "fall" | null
  qty: number
  leverage: number
  margin_mode: MarginMode
  reduce_only: boolean
  post_only: boolean
  time_in_force: TimeInForce
  take_profit: number | null
  stop_loss: number | null
  reserved_margin: number
  status: "open" | "filled" | "cancelled" | "rejected"
  filled_price: number | null
  filled_qty: number
  fee: number
  reject_reason: string | null
  created_at: string
  updated_at: string
}

export interface Fill {
  id: string
  order_id: string | null
  position_id: string | null
  symbol: string
  side: OrderSide
  price: number
  qty: number
  fee: number
  realized_pnl: number
  exec_type: string
  is_maker: boolean
  created_at: string
}

export interface FundingPayment {
  id: string
  symbol: string
  rate: number
  mark_price: number
  amount: number
  funding_time: string
}

export interface FuturesState {
  configured: boolean
  authenticated: boolean
  email?: string
  account: AccountMode
  balance: number
  balances: { real: number; demo: number }
  spotBalance?: number
  fundingHistory?: FundingPayment[]
  positions: Position[]
  openOrders: Order[]
  orderHistory: Order[]
  fills: Fill[]
  closedPositions: Position[]
}

export interface PlaceOrderInput {
  account: AccountMode
  symbol: string
  side: OrderSide
  orderType: OrderType
  qty: number
  price?: number | null
  triggerPrice?: number | null
  leverage: number
  marginMode: MarginMode
  reduceOnly?: boolean
  postOnly?: boolean
  timeInForce?: TimeInForce
  takeProfit?: number | null
  stopLoss?: number | null
}
