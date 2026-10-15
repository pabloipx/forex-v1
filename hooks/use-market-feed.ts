"use client"

import { useEffect, useRef, useState } from "react"
import type { FuturesMarket } from "@/lib/futures/markets"
import type { Ticker } from "@/hooks/use-futures"

export type BookLevel = [price: number, qty: number]
export interface PublicTrade {
  id: string
  price: number
  qty: number
  side: "buy" | "sell"
  time: number
}
export type FeedStatus = "connecting" | "connected" | "fallback" | "disconnected"
export interface MarketFeed {
  bids: BookLevel[]
  asks: BookLevel[]
  trades: PublicTrade[]
  last: number | null
  ticker: Ticker | null
  live: boolean
  status: FeedStatus
}

const EMPTY: MarketFeed = { bids: [], asks: [], trades: [], last: null, ticker: null, live: false, status: "connecting" }
const MAX_TRADES = 40
const BASE_DELAY = 1000
const MAX_DELAY = 30_000
// Sem mensagens por esse tempo, a conexão é considerada morta (proxies às vezes não fecham o socket).
const STALE_MS = 15_000
// Após essa quantidade de falhas seguidas, o terminal passa a usar o REST do servidor até reconectar.
const FALLBACK_AFTER = 3

// Forex/metais: o motor só recebe a melhor compra/venda (sem profundidade), então o livro
// mostra apenas esse nível real e as quantidades ficam vazias (qty 0).
function topOfBook(market: FuturesMarket, bid: number, ask: number) {
  const d = market.priceDecimals
  return {
    bids: [[Number(bid.toFixed(d)), 0]] as BookLevel[],
    asks: [[Number(ask.toFixed(d)), 0]] as BookLevel[],
  }
}

function applyPolled(prev: MarketFeed, market: FuturesMarket, t: Ticker, status: FeedStatus): MarketFeed {
  const { bids, asks } = topOfBook(market, t.bid, t.ask)
  let trades = prev.trades
  if (prev.last != null && prev.last !== t.price) {
    trades = [
      { id: `${t.updatedAt}`, price: t.price, qty: 0, side: t.price > prev.last ? "buy" : "sell", time: Date.now() } satisfies PublicTrade,
      ...trades,
    ].slice(0, MAX_TRADES)
  }
  return { bids, asks, trades, last: t.price, ticker: t, live: true, status }
}

export function useMarketFeed(market: FuturesMarket, polledTicker: Ticker | undefined): MarketFeed {
  const [feed, setFeed] = useState<MarketFeed>(EMPTY)
  const buffer = useRef<MarketFeed>(EMPTY)

  // Cripto: WebSocket público da Binance (livro, negócios e ticker 24h) com backoff exponencial.
  useEffect(() => {
    buffer.current = { ...EMPTY }
    setFeed(EMPTY)
    if (market.source !== "binance") return

    const s = market.symbol.toLowerCase()
    let ws: WebSocket | null = null
    let closed = false
    let failures = 0
    let lastMessage = 0
    let retry: ReturnType<typeof setTimeout> | undefined

    const setStatus = (status: FeedStatus) => {
      buffer.current = { ...buffer.current, status, live: status === "connected" || status === "fallback" }
    }

    const scheduleReconnect = () => {
      if (closed) return
      failures++
      setStatus(failures >= FALLBACK_AFTER ? "fallback" : "disconnected")
      const delay = Math.min(MAX_DELAY, BASE_DELAY * 2 ** (failures - 1)) * (0.75 + Math.random() * 0.5)
      retry = setTimeout(connect, delay)
    }

    const connect = () => {
      if (closed) return
      if (buffer.current.status !== "fallback") setStatus("connecting")
      try {
        ws = new WebSocket(`wss://data-stream.binance.vision/stream?streams=${s}@depth20@100ms/${s}@aggTrade/${s}@ticker`)
      } catch {
        scheduleReconnect()
        return
      }
      ws.onopen = () => {
        failures = 0
        lastMessage = Date.now()
        setStatus("connected")
      }
      ws.onmessage = (ev) => {
        lastMessage = Date.now()
        let msg: { stream?: string; data?: Record<string, unknown> & { bids?: string[][]; asks?: string[][] } }
        try {
          msg = JSON.parse(ev.data)
        } catch {
          return
        }
        const d = msg.data as Record<string, never>
        const stream = msg.stream ?? ""
        const b = buffer.current
        if (stream.endsWith("depth20@100ms")) {
          buffer.current = {
            ...b,
            bids: (d.bids as string[][]).map((l) => [Number(l[0]), Number(l[1])] as BookLevel),
            asks: (d.asks as string[][]).map((l) => [Number(l[0]), Number(l[1])] as BookLevel),
          }
        } else if (stream.endsWith("aggTrade")) {
          const t: PublicTrade = { id: String(d.a), price: Number(d.p), qty: Number(d.q), side: d.m ? "sell" : "buy", time: d.T }
          buffer.current = { ...b, last: t.price, trades: [t, ...b.trades].slice(0, MAX_TRADES) }
        } else if (stream.endsWith("ticker")) {
          buffer.current = {
            ...b,
            ticker: {
              symbol: market.symbol,
              price: Number(d.c),
              bid: Number(d.b),
              ask: Number(d.a),
              changePercent: Number(d.P),
              high: Number(d.h),
              low: Number(d.l),
              volume: Number(d.q),
              updatedAt: Date.now(),
            },
            last: b.last ?? Number(d.c),
          }
        }
      }
      ws.onclose = () => {
        ws = null
        scheduleReconnect()
      }
      ws.onerror = () => ws?.close()
    }
    connect()

    const watchdog = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN && Date.now() - lastMessage > STALE_MS) ws.close()
    }, 5000)

    const onOnline = () => {
      if (!ws) {
        clearTimeout(retry)
        failures = 0
        connect()
      }
    }
    window.addEventListener("online", onOnline)

    // Agrupa as mensagens e atualiza a tela 4x por segundo para não travar a UI.
    const flush = setInterval(() => setFeed(buffer.current), 250)
    return () => {
      closed = true
      clearTimeout(retry)
      clearInterval(flush)
      clearInterval(watchdog)
      window.removeEventListener("online", onOnline)
      ws?.close()
    }
  }, [market])

  // Fallback REST: cotações do servidor (cache) quando o WebSocket cripto está fora,
  // e fonte principal para forex/metais.
  useEffect(() => {
    if (!polledTicker) return
    if (market.source !== "binance") {
      setFeed((prev) => applyPolled(prev, market, polledTicker, "connected"))
      return
    }
    if (buffer.current.status === "fallback") {
      buffer.current = { ...buffer.current, ticker: polledTicker, last: polledTicker.price, live: true }
    }
  }, [market, polledTicker])

  return feed
}
