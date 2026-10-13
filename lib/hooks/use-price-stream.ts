"use client"

import { useEffect, useRef, useState } from "react"
import type { TickData, CandleData, TradeResult } from "@/lib/types"

type StreamMessage =
  | { type: "connected" }
  | TickData
  | CandleData
  | TradeResult
  | { type: "candle_update"; symbol: string; timeframe: number; data: any }

export function usePriceStream(onMessage: (data: StreamMessage) => void) {
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connect = () => {
      try {
        const eventSource = new EventSource("/api/price/stream")

        eventSource.onopen = () => {
          setIsConnected(true)
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === "connected") {
              return
            }
            onMessageRef.current(data)
          } catch (error) {
            // Silent error handling
          }
        }

        eventSource.onerror = () => {
          setIsConnected(false)
          eventSource.close()
          reconnectTimeout = setTimeout(connect, 2000)
        }

        eventSourceRef.current = eventSource
      } catch (error) {
        reconnectTimeout = setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return { isConnected }
}
