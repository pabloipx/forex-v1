"use client"

import { memo, useMemo, useState } from "react"
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

interface GroupedLevel {
  price: number
  qty: number
  total: number
}

// Binance envia preços com mais casas que o tick exibido; sem agrupar, vários níveis
// aparecem com o mesmo preço. Vendas arredondam para cima e compras para baixo, para
// nunca exibir uma oferta melhor do que a real.
function groupLevels(levels: BookLevel[], step: number, side: "bid" | "ask", count: number): GroupedLevel[] {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  const buckets = new Map<string, { price: number; qty: number }>()
  for (const [price, qty] of levels) {
    if (!Number.isFinite(price) || price <= 0) continue
    const units = side === "ask" ? Math.ceil(price / step - 1e-9) : Math.floor(price / step + 1e-9)
    const bucketPrice = Number((units * step).toFixed(decimals))
    const key = bucketPrice.toFixed(decimals)
    const existing = buckets.get(key)
    if (existing) existing.qty += qty
    else buckets.set(key, { price: bucketPrice, qty })
  }
  const sorted = [...buckets.values()].sort((a, b) => (side === "ask" ? a.price - b.price : b.price - a.price))
  let total = 0
  return sorted.slice(0, count).map((l) => {
    total += l.qty
    return { price: l.price, qty: l.qty, total }
  })
}

function rawDecimals(levels: BookLevel[], fallback: number) {
  let max = fallback
  for (const [price] of levels.slice(0, 5)) {
    const s = String(price)
    const i = s.indexOf(".")
    if (i >= 0) max = Math.max(max, s.length - i - 1)
  }
  return Math.min(max, 8)
}

function fmtQty(q: number) {
  if (q <= 0) return "--"
  return q >= 1000 ? q.toLocaleString("en-US", { maximumFractionDigits: 0 }) : q.toFixed(q < 1 ? 4 : 3)
}

interface BookRowProps {
  price: number
  qty: number
  total: number
  side: "bid" | "ask"
  max: number
  decimals: number
  onPriceClick: (price: number) => void
}

// Linha estável (key por posição): o DOM é reaproveitado a cada tick e só textos e
// transform mudam. scaleX roda no compositor, sem reflow como animar width.
const BookRow = memo(function BookRow({ price, qty, total, side, max, decimals, onPriceClick }: BookRowProps) {
  const empty = price <= 0
  const totalScale = max > 0 ? Math.min(1, total / max) : 0
  const qtyScale = max > 0 ? Math.min(1, qty / max) : 0
  return (
    <button
      type="button"
      disabled={empty}
      onClick={() => onPriceClick(price)}
      className="relative grid h-5 w-full shrink-0 grid-cols-3 items-center overflow-hidden px-3 text-right font-mono text-xs tabular-nums hover:bg-term-line/50 disabled:pointer-events-none"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 origin-right transition-transform duration-200 ease-out",
          side === "bid" ? "bg-long/10" : "bg-short/10",
        )}
        style={{ transform: `scaleX(${totalScale})` }}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 origin-right transition-transform duration-200 ease-out",
          side === "bid" ? "bg-long/20" : "bg-short/20",
        )}
        style={{ transform: `scaleX(${qtyScale})` }}
      />
      <span className={cn("relative truncate text-left", side === "bid" ? "text-long" : "text-short")}>
        {empty ? "--" : formatPrice(price, decimals)}
      </span>
      <span className="relative truncate text-term-text">{empty ? "" : fmtQty(qty)}</span>
      <span className="relative truncate text-term-text">{empty ? "" : fmtQty(total)}</span>
    </button>
  )
})

const EMPTY_LEVEL: GroupedLevel = { price: 0, qty: 0, total: 0 }

function BookSide({
  levels,
  rows,
  side,
  max,
  decimals,
  onPriceClick,
}: {
  levels: GroupedLevel[]
  rows: number
  side: "bid" | "ask"
  max: number
  decimals: number
  onPriceClick: (price: number) => void
}) {
  // Sempre o mesmo número de linhas: a altura não pula quando o livro chega incompleto.
  const filled = Array.from({ length: rows }, (_, i) => levels[i] ?? EMPTY_LEVEL)
  return (
    // flex-1 + min-h-0: as linhas que não cabem são cortadas na ponta longe do spread,
    // nunca por cima do cabeçalho ou do rodapé.
    <div
      className={cn(
        "flex min-h-0 flex-1 overflow-hidden [contain:strict]",
        side === "ask" ? "flex-col-reverse" : "flex-col",
      )}
    >
      {filled.map((l, i) => (
        <BookRow
          key={i}
          price={l.price}
          qty={l.qty}
          total={l.total}
          side={side}
          max={max}
          decimals={decimals}
          onPriceClick={onPriceClick}
        />
      ))}
    </div>
  )
}

function Book({ market, feed, onPriceClick }: OrderBookProps) {
  const [view, setView] = useState<View>("both")
  const tick = 10 ** -market.priceDecimals
  const groupOptions = [1, 10, 100].map((m) => Number((tick * m).toFixed(market.priceDecimals)))
  const [groupIndex, setGroupIndex] = useState(0)
  const step = groupOptions[groupIndex] ?? tick
  const groupDecimals = Math.max(0, -Math.floor(Math.log10(step)))
  const rows = view === "both" ? 10 : 20
  const asks = useMemo(() => groupLevels(feed.asks, step, "ask", rows), [feed.asks, step, rows])
  const bids = useMemo(() => groupLevels(feed.bids, step, "bid", rows), [feed.bids, step, rows])
  const max = Math.max(asks.at(-1)?.total ?? 0, bids.at(-1)?.total ?? 0)

  const bestAsk = feed.asks[0]?.[0]
  const bestBid = feed.bids[0]?.[0]
  const spread = bestAsk != null && bestBid != null && bestAsk >= bestBid ? bestAsk - bestBid : null
  const mid = spread != null ? (bestAsk! + bestBid!) / 2 : null
  const spreadDecimals = Math.max(
    rawDecimals(feed.asks, market.priceDecimals),
    rawDecimals(feed.bids, market.priceDecimals),
  )
  const spreadPct = spread != null && mid ? (spread / mid) * 100 : null

  const bidVol = bids.reduce((s, l) => s + l.qty, 0)
  const askVol = asks.reduce((s, l) => s + l.qty, 0)
  const bidPct = bidVol + askVol > 0 ? Math.round((bidVol / (bidVol + askVol)) * 100) : 50

  const prevTrade = feed.trades[1]?.price
  const up = feed.last != null && prevTrade != null ? feed.last >= prevTrade : true

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
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-term-muted">
          <span className="sr-only">Agrupar preços</span>
          <select
            value={groupIndex}
            onChange={(e) => setGroupIndex(Number(e.target.value))}
            className="rounded bg-term-bg px-1.5 py-0.5 font-mono text-term-text outline-none hover:bg-term-line"
          >
            {groupOptions.map((g, i) => (
              <option key={g} value={i}>
                {g.toFixed(Math.max(0, -Math.floor(Math.log10(g))))}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 px-3 pb-1 text-right text-[11px] text-term-muted">
        <span className="text-left">Preço ({market.quote})</span>
        <span>Qtd ({market.category === "crypto" ? market.base : "Lotes"})</span>
        <span>Total</span>
      </div>

      {view !== "bids" && (
        <BookSide levels={asks} rows={rows} side="ask" max={max} decimals={groupDecimals} onPriceClick={onPriceClick} />
      )}

      <div className="flex items-center gap-2 px-3 py-2">
        <span className={cn("flex items-center gap-1 font-mono text-lg font-bold", up ? "text-long" : "text-short")}>
          {up ? <ArrowUp className="size-4" aria-hidden="true" /> : <ArrowDown className="size-4" aria-hidden="true" />}
          {formatPrice(feed.last, market.priceDecimals)}
        </span>
        {spread != null && (
          <span
            className="whitespace-nowrap font-mono text-[11px] text-term-muted"
            title={
              spreadPct != null
                ? `Spread: diferença entre melhor venda e melhor compra (${spreadPct.toFixed(4)}%)`
                : "Spread: diferença entre melhor venda e melhor compra"
            }
          >
            Spread {formatPrice(spread, spreadDecimals)}
          </span>
        )}
        <span
          role="status"
          className={cn(
            "ml-auto flex items-center gap-1.5 whitespace-nowrap text-[11px]",
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
        <BookSide levels={bids} rows={rows} side="bid" max={max} decimals={groupDecimals} onPriceClick={onPriceClick} />
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
          Spread {spread != null ? formatPrice(spread, spreadDecimals) : "--"} · cotação do motor (sem profundidade)
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
      <div role="tablist" className="flex gap-5 border-b border-term-line px-3 phone:gap-3 phone:px-2">
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
              "border-b-2 py-2.5 text-sm font-semibold phone:text-xs",
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
