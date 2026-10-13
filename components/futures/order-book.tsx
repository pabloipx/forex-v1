"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice, type FuturesMarket } from "@/lib/futures/markets"
import type { BookLevel, MarketFeed } from "@/hooks/use-market-feed"

interface OrderBookProps {
  market: FuturesMarket
  feed: MarketFeed
  onPriceClick: (price: number) => void
}

type View = "both" | "bids" | "asks"

function withTotals(levels: BookLevel[], count: number) {
  let total = 0
  return levels.slice(0, count).map(([price, qty]) => {
    total += qty
    return { price, qty, total }
  })
}

function fmtQty(q: number) {
  if (q <= 0) return "--"
  return q >= 1000 ? q.toLocaleString("en-US", { maximumFractionDigits: 0 }) : q.toFixed(q < 1 ? 4 : 3)
}

function Book({ market, feed, onPriceClick }: OrderBookProps) {
  const [view, setView] = useState<View>("both")
  const rows = view === "both" ? 10 : 20
  const asks = useMemo(() => withTotals(feed.asks, rows), [feed.asks, rows])
  const bids = useMemo(() => withTotals(feed.bids, rows), [feed.bids, rows])
  const max = Math.max(asks.at(-1)?.total ?? 0, bids.at(-1)?.total ?? 0, 1)

  const bidVol = bids.reduce((s, l) => s + l.qty, 0)
  const askVol = asks.reduce((s, l) => s + l.qty, 0)
  const bidPct = bidVol + askVol > 0 ? Math.round((bidVol / (bidVol + askVol)) * 100) : 50

  const prevTrade = feed.trades[1]?.price
  const up = feed.last != null && prevTrade != null ? feed.last >= prevTrade : true

  const Row = ({ price, qty, total, side }: { price: number; qty: number; total: number; side: "bid" | "ask" }) => (
    <button
      onClick={() => onPriceClick(price)}
      className="relative grid w-full grid-cols-3 px-3 py-[3px] text-right font-mono text-xs hover:bg-term-line/50"
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-0 right-0", side === "bid" ? "bg-long/15" : "bg-short/15")}
        style={{ width: `${(total / max) * 100}%` }}
      />
      <span className={cn("relative text-left", side === "bid" ? "text-long" : "text-short")}>
        {formatPrice(price, market.priceDecimals)}
      </span>
      <span className="relative text-term-text">{fmtQty(qty)}</span>
      <span className="relative text-term-text">{fmtQty(total)}</span>
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 px-3 py-2">
        {(["both", "bids", "asks"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-pressed={view === v}
            aria-label={v === "both" ? "Compra e venda" : v === "bids" ? "Somente compras" : "Somente vendas"}
            className={cn("flex size-6 flex-col justify-center gap-0.5 rounded p-1", view === v && "bg-term-line")}
          >
            {v !== "bids" && <span className="h-1 w-full rounded-sm bg-short" />}
            {v === "both" && <span className="h-1 w-full rounded-sm bg-long" />}
            {v === "bids" && (
              <>
                <span className="h-1 w-full rounded-sm bg-long" />
                <span className="h-1 w-full rounded-sm bg-long" />
              </>
            )}
            {v === "asks" && <span className="h-1 w-full rounded-sm bg-short" />}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 px-3 pb-1 text-right text-[11px] text-term-muted">
        <span className="text-left">Preço ({market.quote})</span>
        <span>Qtd ({market.category === "crypto" ? market.base : "Lotes"})</span>
        <span>Total</span>
      </div>

      {view !== "bids" && (
        <div className="flex flex-col-reverse">
          {asks.map((l) => (
            <Row key={`a${l.price}`} {...l} side="ask" />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2">
        <span className={cn("flex items-center gap-1 font-mono text-lg font-bold", up ? "text-long" : "text-short")}>
          {up ? <ArrowUp className="size-4" aria-hidden="true" /> : <ArrowDown className="size-4" aria-hidden="true" />}
          {formatPrice(feed.last, market.priceDecimals)}
        </span>
        <span
          role="status"
          className={cn(
            "ml-auto flex items-center gap-1.5 text-[11px]",
            feed.status === "connected" ? "text-long" : feed.status === "disconnected" ? "text-short" : "text-term-muted",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              feed.status === "connected" ? "bg-long" : feed.status === "disconnected" ? "bg-short" : "animate-pulse bg-primary",
            )}
          />
          {feed.status === "connected"
            ? "ao vivo"
            : feed.status === "fallback"
              ? "REST (reconectando)"
              : feed.status === "disconnected"
                ? "desconectado"
                : "conectando..."}
        </span>
      </div>

      {view !== "asks" && (
        <div className="flex flex-col">
          {bids.map((l) => (
            <Row key={`b${l.price}`} {...l} side="bid" />
          ))}
        </div>
      )}

      {bidVol + askVol > 0 ? (
      <div className="mt-auto flex items-center gap-1 px-3 py-2 font-mono text-[11px]">
        <span className="rounded border border-long px-1 text-long">C</span>
        <span className="text-long">{bidPct}%</span>
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full">
          <span className="bg-long" style={{ width: `${bidPct}%` }} />
          <span className="flex-1 bg-short" />
        </div>
        <span className="text-short">{100 - bidPct}%</span>
        <span className="rounded border border-short px-1 text-short">V</span>
      </div>
      ) : (
        <p className="mt-auto px-3 py-2 text-[11px] leading-relaxed text-term-muted">
          Spread {formatPrice((asks[0]?.price ?? 0) - (bids[0]?.price ?? 0), market.priceDecimals)} · cotação do motor
        </p>
      )}
    </div>
  )
}

function Trades({ market, feed, onPriceClick }: OrderBookProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 px-3 py-2 text-right text-[11px] text-term-muted">
        <span className="text-left">Preço ({market.quote})</span>
        <span>Qtd</span>
        <span>Hora</span>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {feed.trades.length === 0 && <li className="px-3 py-6 text-center text-xs text-term-muted">Aguardando negócios...</li>}
        {feed.trades.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => onPriceClick(t.price)}
              className="grid w-full grid-cols-3 px-3 py-[3px] text-right font-mono text-xs hover:bg-term-line/50"
            >
              <span className={cn("text-left", t.side === "buy" ? "text-long" : "text-short")}>
                {formatPrice(t.price, market.priceDecimals)}
              </span>
              <span className="text-term-text">{fmtQty(t.qty)}</span>
              <span className="text-term-muted">
                {new Date(t.time).toLocaleTimeString("pt-BR", { hour12: false })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function OrderBookPanel(props: OrderBookProps) {
  const [tab, setTab] = useState<"book" | "trades">("book")
  return (
    <section aria-label="Livro de ofertas" className="flex h-full flex-col bg-term-panel">
      <div role="tablist" className="flex gap-5 border-b border-term-line px-3">
        {(
          [
            ["book", "Livro de ofertas"],
            ["trades", "Últimos trades"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "border-b-2 py-2.5 text-sm font-semibold",
              tab === key ? "border-primary text-term-text" : "border-transparent text-term-muted hover:text-term-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">{tab === "book" ? <Book {...props} /> : <Trades {...props} />}</div>
    </section>
  )
}
