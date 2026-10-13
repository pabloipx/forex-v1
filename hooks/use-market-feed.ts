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
export interface MarketFeed {
  bids: BookLevel[]
  asks: BookLevel[]
  trades: PublicTrade[]
  last: number | null
  ticker: Ticker | null
  live: boolean
}

const EMPTY: MarketFeed = { bids: [], asks: [], trades: [], last: null, ticker: null, live: false }
const MAX_TRADES = 40

// Forex/metais: o motor so recebe a melhor compra/venda (sem profundidade), entao o livro
// mostra apenas esse nivel real e as quantidades ficam vazias (qty 0).
function topOfBook(market: FuturesMarket, bid: number, ask: number) {
  const d = market.priceDecimals
  return {
    bids: [[Number(bid.toFixed(d)), 0]] as BookLevel[],
    asks: [[Number(ask.toFixed(d)), 0]] as BookLevel[],
  }
}

export function useMarketFeed(market: FuturesMarket, polledTicker: Ticker | undefined): MarketFeed {
  const [feed, setFeed] = useState<MarketFeed>(EMPTY)
  const buffer = useRef<MarketFeed>(EMPTY)

  // Cripto: WebSocket publico da Binance (livro, negocios e ticker 24h em tempo real).
  useEffect(() => {
    buffer.current = { ...EMPTY }
    setFeed(EMPTY)
    if (market.source !== "binance") return

    const s = market.symbol.toLowerCase()
    let ws: WebSocket | null = null
    let closed = false
    let retry: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      ws = new WebSocket(
        `wss://data-stream.binance.vision/stream?streams=${s}@depth20@100ms/${s}@aggTrade/${s}@ticker`,
      )
      ws.onopen = () => {
        buffer.current = { ...buffer.current, live: true }
      }
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        const d = msg.data
        const b = buffer.current
        if (msg.stream.endsWith("depth20@100ms")) {
          buffer.current = {
            ...b,
            bids: d.bids.map((l: string[]) => [Number(l[0]), Number(l[1])]),
            asks: d.asks.map((l: string[]) => [Number(l[0]), Number(l[1])]),
          }
        } else if (msg.stream.endsWith("aggTrade")) {
          const t: PublicTrade = {
            id: String(d.a),
            price: Number(d.p),
            qty: Number(d.q),
            side: d.m ? "sell" : "buy",
            time: d.T,
          }
          buffer.current = { ...b, last: t.price, trades: [t, ...b.trades].slice(0, MAX_TRADES) }
        } else if (msg.stream.endsWith("ticker")) {
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
        buffer.current = { ...buffer.current, live: false }
        if (!closed) retry = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws?.close()
    }
    connect()

    // Agrupa as mensagens e atualiza a tela 4x por segundo para nao travar a UI.
    const flush = setInterval(() => setFeed(buffer.current), 250)
    return () => {
      closed = true
      clearTimeout(retry)
      clearInterval(flush)
      ws?.close()
    }
  }, [market])

  // Forex/metais: usa as cotacoes do servidor (TradingView) consultadas pelo SWR.
  useEffect(() => {
    if (market.source === "binance" || !polledTicker) return
    setFeed((prev) => {
      const { bids, asks } = topOfBook(market, polledTicker.bid, polledTicker.ask)
      let trades = prev.trades
      if (prev.last != null && prev.last !== polledTicker.price) {
        const side = polledTicker.price > prev.last ? "buy" : "sell"
        trades = [
          {
            id: `${polledTicker.updatedAt}`,
            price: polledTicker.price,
            qty: 0,
            side,
            time: Date.now(),
          } satisfies PublicTrade,
          ...trades,
        ].slice(0, MAX_TRADES)
      }
      return { bids, asks, trades, last: polledTicker.price, ticker: polledTicker, live: true }
    })
  }, [market, polledTicker])

  return feed
}
