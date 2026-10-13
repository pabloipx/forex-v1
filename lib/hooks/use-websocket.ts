"use client"

import { useState } from "react"
import type { TickData, CandleData, TradeResult } from "@/lib/types"

type WebSocketMessage =
  | TickData
  | CandleData
  | TradeResult
  | { type: "candle_update"; symbol: string; timeframe: number; data: any }

/**
 * WebSocket hook placeholder
 * Note: WebSockets are not directly supported in Next.js serverless.
 * Price updates are handled via polling in use-price-stream.ts
 */
export function useWebSocket(_onMessage: (data: WebSocketMessage) => void) {
  const [isConnected] = useState(false)

  const send = (_data: any) => {
    // No-op: WebSocket not supported
  }

  return { isConnected, send }
}
